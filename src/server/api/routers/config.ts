import { z } from "zod";
import { stripe, toStripeAddress } from "@/util/stripe";
import { env } from "@/env";
import prices from "@/util/prices";
import type Stripe from "stripe";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { processPdfModules } from "@/util/pdf/converter";
import type { ColorCode, ModuleId } from "@/app/_components/module-changer";
import { calculatePrintCost } from "@/util/pdf/calculator";
import { encryptPayload } from "@/util/crypto";
import { createCancelKey } from "@/util/order/functions";
import { cloneBookForOrder } from "@/util/book/clone-book";

const ConfigAddressSchema = z.object({
  org: z.string().optional(),
  title: z.string().optional(),
  name: z.string(),
  prename: z.string(),
  street: z.string(),
  streetNr: z.string(),
  city: z.string(),
  zip: z.string(),
  optional: z.string().optional(),
  state: z.string().optional(),
  email: z.string(),
  phone: z.string().optional(),
});

const ConfigDetailsSchema = z.object({
  bookId: z.string(),
  isPickup: z.boolean(),
  format: z.enum(["DIN A4", "DIN A5"]).default("DIN A5"),
  quantity: z.number().min(1).max(300000),
  saveUser: z.boolean(),
});

export type ConfigAddress = z.infer<typeof ConfigAddressSchema>;

export const configRouter = createTRPCRouter({
  setupOrder: publicProcedure
    .input(
      z.object({
        details: ConfigDetailsSchema,
        orderAddress: ConfigAddressSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const { details, orderAddress } = input;

      const { bookId, quantity, format, saveUser, isPickup } = details;

      const existingBook = await db.book.findFirst({
        where: {
          id: bookId,
        },
        include: {
          modules: {
            include: {
              module: {
                include: {
                  type: true,
                  files: true,
                },
              },
            },
          },
        },
      });

      if (!existingBook) {
        throw new Error("book doesn't exist. must order a book.");
      }
      const existingUser = await db.user.findUnique({
        where: {
          email: orderAddress.email,
        },
      });
      const moduleColorMap = new Map<ModuleId, ColorCode>();
      const pdfModules = existingBook.modules.map((p) => {
        const type = p.module.type.name;
        let pdfUrl =
          p.module.files.find((f) => f.name?.startsWith("file_"))?.src ??
          "/storage/notizen.pdf";

        pdfUrl = env.NEXT_PUBLIC_CDN_SERVER_URL + pdfUrl;

        moduleColorMap.set(p.id, p.colorCode === "COLOR" ? 4 : 1);

        return {
          id: p.id,
          idx: p.idx,
          type,
          pdfUrl,
        };
      });

      let result: Awaited<ReturnType<typeof processPdfModules>>;

      try {
        result = await processPdfModules(
          {
            title: existingBook?.bookTitle ?? "Hausaufgaben",
            period: {
              start: existingBook?.planStart,
              end: existingBook?.planEnd ?? undefined,
            },
            code: existingBook?.region ?? "DE-SL",
            addHolidays: true,
          },
          pdfModules,
          {
            compressionLevel: "high",
            colorMap: moduleColorMap,
          },
        );
      } catch (e) {
        console.error(e);
        throw new Error("PDF PROCESSING ERROR");
      }

      const estimatedCost = calculatePrintCost({
        amount: quantity,
        bPages: result.details.bPages,
        cPages: result.details.cPages,
        format,
        prices,
      });

      let createdUser: Awaited<ReturnType<typeof db.user.create>> | undefined;
      if (!existingUser && saveUser) {
        createdUser = await db.user.create({
          data: {
            email: orderAddress.email,
          },
        });
      }

      const existingCustomers = await stripe.customers.list({
        email: orderAddress.email,
        limit: 1,
      });

      let customer: Stripe.Customer | Stripe.DeletedCustomer | undefined;
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        const address = toStripeAddress(orderAddress);
        const shipping = {
          address: toStripeAddress(orderAddress),
          name: `${orderAddress.title !== undefined ? `${orderAddress.title} ` : null} ${orderAddress.prename} ${orderAddress.name}`,
          phone: orderAddress.phone,
        };

        // Customer does not exist, create a new one
        customer = await stripe.customers.create({
          email: orderAddress.email,
          address,
          shipping,
          metadata: {
            userId: existingUser?.id ?? createdUser?.id ?? "guest-user",
          },
        });
      }

      if (!customer) throw new Error("something went wrong. try again later.");

      const unitAmountCents = estimatedCost.total;

      const createdPayment = await db.payment.create({
        data: {
          price: unitAmountCents,
        },
      });

      const createdOrderId = await cloneBookForOrder(
        existingBook.id,
        createdPayment.id,
        quantity,
      );

      const cancelKey = createCancelKey(createdOrderId);

      const cancelParams = encryptPayload({
        bookId: existingBook.id,
        paymentId: createdPayment.id,
        cancelKey,
      });

      const baseParams = {
        mode: "payment" as Stripe.Checkout.SessionCreateParams["mode"],
        customer: customer.id,
        success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.STRIPE_CANCEL_URL}?q=${cancelParams}`,
        invoice_creation: { enabled: true },
        customer_update: {
          shipping: "auto",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              tax_behavior: "inclusive",
              product_data: {
                name: existingBook.name ?? existingBook.id,
                description: "planners by pirrot.de",
                tax_code: "txcd_20090028",
              },
              unit_amount: unitAmountCents,
            },
          },
        ],
        automatic_tax: { enabled: true },
        metadata: {
          orderId: createdOrderId,
        },
      };

      const sessionParams = isPickup
        ? {
            ...baseParams,

            phone_number_collection: { enabled: true },
          }
        : ({
            ...baseParams,
            shipping_address_collection: {
              allowed_countries: ["DE", "AT", "NL", "LU", "FR", "ES", "IT"],
            },

            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  tax_behavior: "inclusive",
                  fixed_amount: { amount: 1000, currency: "eur" },
                  display_name: "Standard Shipping",
                  delivery_estimate: {
                    minimum: { unit: "business_day", value: 14 },
                    maximum: { unit: "business_day", value: 21 },
                  },
                },
              },

              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  tax_behavior: "inclusive",
                  fixed_amount: { amount: 3000, currency: "eur" },
                  display_name: "Express Shipping",
                  delivery_estimate: {
                    minimum: { unit: "business_day", value: 7 },
                    maximum: { unit: "business_day", value: 10 },
                  },
                },
              },
            ],
          } as Stripe.Checkout.SessionCreateParams);

      const checkout = await stripe.checkout.sessions.create(
        sessionParams as Stripe.Checkout.SessionCreateParams,
      );

      await db.payment.update({
        where: {
          id: createdPayment.id,
        },
        data: {
          cancelKey,
          shopId: checkout.id,
          bookOrder: {
            connect: {
              id: createdOrderId,
            },
          },
        },
      });

      return { checkout_session: checkout.url };
    }),
  init: publicProcedure
    .input(
      z.object({
        bookId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { bookId } = input;

      const existingBook = await db.book.findFirst({
        where: {
          id: bookId,
        },
        include: {
          modules: {
            include: {
              module: true,
            },
            orderBy: {
              idx: "asc",
            },
          },
          customDates: true,
        },
      });

      const isUserConfig =
        existingBook?.createdById !== null &&
        existingBook?.createdById !== ctx.session?.user.id;

      if (isUserConfig) {
        return null;
      }

      const userId = ctx.session?.user.id ?? null;

      const combinedModules = await db.module.findMany({
        where: {
          deletedAt: null,
          OR: [
            {
              visible: "PUBLIC",
            },
            {
              createdById: userId,
            },
          ],
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          _count: {
            select: { books: true },
          },
          type: true,
          files: true,
        },
      });

      const moduleResponse = combinedModules.map((moduleItem) => {
        const { id, name, theme, files, type, part, createdAt } = moduleItem;

        const thumbnailFile = files.find((f) => f.name?.startsWith("thumb_"));
        const moduleFile = files.find((f) => f.name?.startsWith("file_"));

        const thumbnail =
          thumbnailFile && !thumbnailFile.src.startsWith("https://")
            ? `https://cdn.pirrot.de${thumbnailFile.src}`
            : (thumbnailFile?.src ?? "/default.png");

        const url =
          moduleFile && !moduleFile.src.startsWith("https://")
            ? `https://cdn.pirrot.de${moduleFile.src}`
            : (moduleFile?.src ?? "/storage/notizen.pdf");

        return {
          id,
          name,
          theme,
          part,
          type: type.name,
          thumbnail,
          url,
          creteadAt: createdAt,
          booksCount: moduleItem._count.books,
        };
      });

      const existingTypes = await db.moduleType.findMany({
        where: {
          name: {
            notIn: ["custom"],
          },
        },
      });
      const existingTips = await db.tooltip.findMany();

      return {
        modules: moduleResponse.sort((a, b) => a.booksCount - b.booksCount),
        book: existingBook,
        types: existingTypes.map((t) => ({ id: t.id, name: t.name })),
        tips: existingTips.map((tip) => ({
          id: tip.id,
          title: tip.title,
          content: tip.tip,
        })),
      };
    }),
});
