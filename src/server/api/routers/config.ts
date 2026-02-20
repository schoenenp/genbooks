import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { stripeClient, toStripeAddress } from "@/util/stripe";
import { env } from "@/env";
import prices from "@/util/prices";
import type Stripe from "stripe";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { calculatePdfPageCounts } from "@/util/pdf/converter";
import type { ColorCode, ModuleId } from "@/app/_components/module-changer";
import { calculatePrintCost } from "@/util/pdf/calculator";
import { encryptPayload } from "@/util/crypto";
import createOrderKey, {
  createCancelKey,
  sendOrderVerification,
} from "@/util/order/functions";
import { createOrderConfirmationEmail } from "@/util/order/templates/create-validation-order";
import { cloneBookForOrder } from "@/util/book/clone-book";
import {
  type SponsoredCheckoutClaims,
  verifySponsorToken,
} from "@/util/sponsor-link";
import {
  createSponsorInvoicesForRedemption,
  retrySponsorProofInvoiceAsync,
  type SponsorSessionMetadata,
} from "@/util/sponsor/invoices";
import { logger } from "@/util/logger";
import { enforceProcedureRateLimit } from "@/util/rate-limit";
import { buildModuleFeedVisibilityWhere } from "./module-visibility";
import { canAccessBookForSetupOrder } from "./setup-order-access";

const REQUIRED_TEXT_MIN = 1;
const NAME_MAX = 120;
const STREET_MAX = 160;
const STREET_NO_MAX = 24;
const CITY_MAX = 120;
const ZIP_MAX = 16;
const TITLE_MAX = 24;
const ORG_MAX = 140;
const OPTIONAL_MAX = 240;
const STATE_MAX = 80;
const PHONE_MAX = 40;
const EMAIL_MAX = 254;

const OptionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return value.length > 0 ? value : undefined;
    });

const ConfigAddressSchema = z.object({
  org: OptionalTrimmedString(ORG_MAX),
  title: OptionalTrimmedString(TITLE_MAX),
  name: z.string().trim().min(REQUIRED_TEXT_MIN).max(NAME_MAX),
  prename: z.string().trim().min(REQUIRED_TEXT_MIN).max(NAME_MAX),
  street: z.string().trim().min(REQUIRED_TEXT_MIN).max(STREET_MAX),
  streetNr: z.string().trim().min(REQUIRED_TEXT_MIN).max(STREET_NO_MAX),
  city: z.string().trim().min(REQUIRED_TEXT_MIN).max(CITY_MAX),
  zip: z
    .string()
    .trim()
    .min(3)
    .max(ZIP_MAX)
    .regex(/^[A-Za-z0-9 -]+$/),
  optional: OptionalTrimmedString(OPTIONAL_MAX),
  state: OptionalTrimmedString(STATE_MAX),
  email: z.string().trim().email().max(EMAIL_MAX),
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX)
    .regex(/^[0-9+()\-./\s]*$/)
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return value.length > 0 ? value : undefined;
    }),
});

const ConfigDetailsSchema = z.object({
  bookId: z.string(),
  isPickup: z.boolean(),
  format: z.enum(["DIN A4", "DIN A5"]).default("DIN A5"),
  quantity: z.number().min(1).max(5000),
  saveUser: z.boolean(),
  sponsorToken: z.string().optional(),
});

export type ConfigAddress = z.infer<typeof ConfigAddressSchema>;
const STRIPE_GERMAN_LOCALE = "de";

export const configRouter = createTRPCRouter({
  setupOrder: publicProcedure
    .input(
      z.object({
        details: ConfigDetailsSchema,
        orderAddress: ConfigAddressSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceProcedureRateLimit(ctx, {
        scope: "config.setupOrder",
        maxRequests: 6,
        windowMs: 10 * 60 * 1000,
      });

      const { db } = ctx;

      const { details, orderAddress } = input;

      const { bookId, quantity, format, saveUser, isPickup, sponsorToken } =
        details;

      let sponsorClaims: SponsoredCheckoutClaims | undefined;
      if (sponsorToken) {
        const claims = verifySponsorToken(sponsorToken);
        if (claims.kind !== "sponsored_checkout") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid sponsor checkout token",
          });
        }
        sponsorClaims = claims;
      }

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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "book doesn't exist. must order a book.",
        });
      }

      const sessionUserId = ctx.session?.user.id;
      if (
        !canAccessBookForSetupOrder({
          bookOwnerId: existingBook.createdById,
          sessionUserId,
        })
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const calculateBookCost = async (bookForCost: {
        bookTitle: string | null;
        planStart: Date;
        planEnd: Date | null;
        region: string | null;
        country: string;
        modules: Array<{
          id: string;
          idx: number;
          colorCode: "COLOR" | "GRAYSCALE" | null;
          module: {
            type: { name: string };
            files: Array<{ name: string | null; src: string }>;
          };
        }>;
      }) => {
        const moduleColorMap = new Map<ModuleId, ColorCode>();
        const pdfModules = bookForCost.modules.map((moduleItem) => {
          const type = moduleItem.module.type.name;
          let pdfUrl =
            moduleItem.module.files.find((file) => file.name?.startsWith("file_"))
              ?.src ?? "/storage/notizen.pdf";

          pdfUrl = env.NEXT_PUBLIC_CDN_SERVER_URL + pdfUrl;
          moduleColorMap.set(
            moduleItem.id,
            moduleItem.colorCode === "COLOR" ? 4 : 1,
          );

          return {
            id: moduleItem.id,
            idx: moduleItem.idx,
            type,
            pdfUrl,
          };
        });

        const pageCounts = await calculatePdfPageCounts(
          {
            title: bookForCost.bookTitle ?? "Hausaufgaben",
            period: {
              start: bookForCost.planStart,
              end: bookForCost.planEnd ?? undefined,
            },
            code: bookForCost.region ?? "DE-SL",
            country: bookForCost.country ?? "DE",
            addHolidays: true,
          },
          pdfModules,
          {
            colorMap: moduleColorMap,
          },
        );

        return calculatePrintCost({
          amount: quantity,
          bPages: pageCounts.bPages,
          cPages: pageCounts.cPages,
          format,
          prices,
        });
      };

      const existingUser = await db.user.findUnique({
        where: {
          email: orderAddress.email,
        },
      });

      let estimatedCost: { single: number; total: number };
      try {
        estimatedCost = await calculateBookCost(existingBook);
      } catch (e) {
        logger.error("config_setup_order_cost_calculation_failed", {
          bookId: existingBook.id,
          error: e,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "PDF PROCESSING ERROR",
        });
      }

      let unitAmountCents = estimatedCost.total;
      let unitAmountPerPlannerCents = estimatedCost.single;
      let isSponsoredCheckout = false;
      let sponsorMetadata: SponsorSessionMetadata | undefined;

      if (sponsorClaims) {
        const campaign = await stripeClient.promotionCodes.retrieve(
          sponsorClaims.promotionCodeId,
        );
        const campaignMetadata = campaign.metadata ?? {};

        if (campaignMetadata.kind !== "sponsor_campaign") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sponsor campaign not found",
          });
        }
        if (!campaign.active) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Promo code is no longer active",
          });
        }
        if (campaign.expires_at && campaign.expires_at < Math.floor(Date.now() / 1000)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Promo code has expired",
          });
        }
        if (
          campaign.max_redemptions &&
          campaign.times_redeemed >= campaign.max_redemptions
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Promo code has already been used",
          });
        }
        if (
          campaignMetadata.sponsorUserId !== sponsorClaims.sponsorUserId ||
          campaignMetadata.templateId !== sponsorClaims.templateId ||
          campaignMetadata.snapshotBookId !== sponsorClaims.snapshotBookId
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sponsor campaign mismatch",
          });
        }
        if (
          campaign.code.trim().toUpperCase() !==
          sponsorClaims.promotionCode.trim().toUpperCase()
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Promo code mismatch",
          });
        }
        if (existingBook.copyFromId !== sponsorClaims.snapshotBookId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The current planner is not tied to this campaign",
          });
        }

        const snapshotBook = await db.book.findFirst({
          where: {
            id: sponsorClaims.snapshotBookId,
            deletedAt: null,
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

        if (!snapshotBook) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sponsor snapshot template not found",
          });
        }

        const baseCost = await calculateBookCost(snapshotBook);
        const baseModuleIds = new Set(
          snapshotBook.modules.map((moduleItem) => moduleItem.moduleId),
        );
        const additionalModules = existingBook.modules.filter(
          (moduleItem) => !baseModuleIds.has(moduleItem.moduleId),
        );

        let addOnPerPlanner = 0;
        let addOnTotal = 0;

        if (additionalModules.length > 0) {
          const additionalCost = await calculateBookCost({
            bookTitle: existingBook.bookTitle,
            planStart: existingBook.planStart,
            planEnd: existingBook.planEnd,
            region: existingBook.region,
            country: existingBook.country,
            modules: additionalModules,
          });
          addOnPerPlanner = additionalCost.single;
          addOnTotal = additionalCost.total;
        }

        unitAmountPerPlannerCents = addOnPerPlanner;
        unitAmountCents = addOnTotal;
        isSponsoredCheckout = true;
        const sponsorStripeAccountId = campaignMetadata.sponsorAccountId ?? "";
        if (!sponsorStripeAccountId.startsWith("acct_")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sponsor account is unavailable for this campaign",
          });
        }

        sponsorMetadata = {
          sponsorUserId: sponsorClaims.sponsorUserId,
          sponsorBaseUnitAmount: baseCost.single,
          sponsorBaseTotalAmount: baseCost.single * quantity,
          sponsorStripeAccountId,
          sponsorTemplateId: sponsorClaims.templateId,
          sponsorSnapshotBookId: sponsorClaims.snapshotBookId,
          sponsorPromotionCodeId: sponsorClaims.promotionCodeId,
        };
      }

      let createdUser: Awaited<ReturnType<typeof db.user.create>> | undefined;
      if (!existingUser && saveUser) {
        createdUser = await db.user.create({
          data: {
            email: orderAddress.email,
          },
        });
      }

      const existingCustomers = await stripeClient.customers.list({
        email: orderAddress.email,
        limit: 1,
      });
      const existingCustomer = existingCustomers.data[0];

      let customer: Stripe.Customer | Stripe.DeletedCustomer | undefined;
      if (existingCustomer) {
        customer = await stripeClient.customers.update(existingCustomer.id, {
          preferred_locales: [STRIPE_GERMAN_LOCALE],
        });
      } else {
        const address = toStripeAddress(orderAddress);
        const shipping = {
          address: toStripeAddress(orderAddress),
          name: `${orderAddress.title !== undefined ? `${orderAddress.title} ` : null} ${orderAddress.prename} ${orderAddress.name}`,
          phone: orderAddress.phone,
        };

        // Customer does not exist, create a new one
        customer = await stripeClient.customers.create({
          email: orderAddress.email,
          address,
          shipping,
          preferred_locales: [STRIPE_GERMAN_LOCALE],
          metadata: {
            userId: existingUser?.id ?? createdUser?.id ?? "guest-user",
          },
        });
      }

      if (!customer) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "something went wrong. try again later.",
        });
      }

      let createdPayment: Awaited<ReturnType<typeof db.payment.create>> | null =
        null;
      let createdOrderId = "";

      try {
        createdPayment = await db.payment.create({
          data: {
            price: unitAmountCents,
          },
        });

        createdOrderId = await cloneBookForOrder(
          existingBook.id,
          createdPayment.id,
          quantity,
        );
      } catch (error) {
        if (createdPayment?.id) {
          await db.payment
            .delete({
              where: { id: createdPayment.id },
            })
            .catch(() => undefined);
        }
        throw error;
      }

      const cancelKey = createCancelKey(createdOrderId);

      const cancelParams = encryptPayload({
        bookId: existingBook.id,
        orderId: createdOrderId,
        cancelKey,
      });

      const checkoutMetadata: Record<string, string> = {
        orderId: createdOrderId,
      };

      if (sponsorMetadata) {
        checkoutMetadata.sponsorFlow = "1";
        checkoutMetadata.sponsorUserId = sponsorMetadata.sponsorUserId;
        checkoutMetadata.sponsorTemplateId = sponsorMetadata.sponsorTemplateId;
        checkoutMetadata.sponsorSnapshotBookId =
          sponsorMetadata.sponsorSnapshotBookId;
        checkoutMetadata.sponsorPromotionCodeId =
          sponsorMetadata.sponsorPromotionCodeId;
        checkoutMetadata.sponsorStripeAccountId =
          sponsorMetadata.sponsorStripeAccountId;
        checkoutMetadata.sponsorBaseUnitAmount = String(
          sponsorMetadata.sponsorBaseUnitAmount,
        );
        checkoutMetadata.sponsorBaseTotalAmount = String(
          sponsorMetadata.sponsorBaseTotalAmount,
        );
        checkoutMetadata.sponsorSchoolUnitAmount = String(
          unitAmountPerPlannerCents,
        );
      }

      if (unitAmountCents <= 0) {
        const createdOrder = await db.$transaction(async (tx) => {
          await tx.payment.update({
            where: {
              id: createdPayment.id,
            },
            data: {
              cancelKey,
              status: "SUCCEEDED",
              total: 0,
              shippingCost: 0,
              bookOrder: {
                connect: {
                  id: createdOrderId,
                },
              },
            },
          });

          const createdOrderRecord = await tx.order.create({
            data: {
              user: ctx.session?.user
                ? {
                    connect: {
                      id: ctx.session.user.id,
                    },
                  }
                : undefined,
              bookOrder: {
                connect: {
                  id: createdOrderId,
                },
              },
            },
          });

          const createdOrderKey = createOrderKey(createdOrderRecord.id);
          await tx.order.update({
            where: {
              id: createdOrderRecord.id,
            },
            data: {
              orderKey: createdOrderKey,
            },
          });
          return {
            id: createdOrderRecord.id,
            orderKey: createdOrderKey,
          };
        });

        if (sponsorMetadata) {
          const sponsorInvoiceInput = {
            db: ctx.db,
            referenceId: `direct_${createdOrder.id}`,
            sponsor: sponsorMetadata,
            school: {
              email: orderAddress.email,
              name: `${orderAddress.prename} ${orderAddress.name}`.trim(),
              address: toStripeAddress(orderAddress),
              phone: orderAddress.phone,
            },
            quantity,
          } as const;

          try {
            await createSponsorInvoicesForRedemption(sponsorInvoiceInput);
          } catch (invoiceError) {
            logger.error("sponsor_invoice_creation_failed_direct_checkout", {
              referenceId: sponsorInvoiceInput.referenceId,
              error: invoiceError,
            });
            retrySponsorProofInvoiceAsync(sponsorInvoiceInput);
          }
        }

        try {
          const html = await createOrderConfirmationEmail(
            createdOrder.orderKey,
            `${orderAddress.prename} ${orderAddress.name}`.trim(),
          );
          await sendOrderVerification(
            orderAddress.email,
            "Bestellung bestätigt - Pirrot",
            html,
          );
        } catch (emailError) {
          logger.error("direct_checkout_confirmation_email_failed", {
            orderId: createdOrder.id,
            error: emailError,
          });
        }

        const orderPayload = encryptPayload({ orderKey: createdOrder.orderKey });
        return {
          redirect_url: `/payment/success?order_ref=${encodeURIComponent(
            orderPayload,
          )}&flow=direct`,
        };
      }

      const baseParams = {
        mode: "payment" as Stripe.Checkout.SessionCreateParams["mode"],
        locale: STRIPE_GERMAN_LOCALE,
        customer: customer.id,
        success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.STRIPE_CANCEL_URL}?q=${cancelParams}`,
        invoice_creation: { enabled: true },
        customer_update: {
          shipping: "auto",
        },
        line_items: [
          {
            quantity: isSponsoredCheckout ? quantity : 1,
            price_data: {
              currency: "eur",
              tax_behavior: "inclusive",
              product_data: {
                name: isSponsoredCheckout
                  ? "Zusatzmodul"
                  : (existingBook.name ?? existingBook.id),
                description: isSponsoredCheckout
                  ? "Zusätzliche Module zur gesponserten Vorlage"
                  : "Planer von pirrot.de",
                tax_code: "txcd_20090028",
              },
              unit_amount: isSponsoredCheckout
                ? unitAmountPerPlannerCents
                : unitAmountCents,
            },
          },
        ],
        automatic_tax: { enabled: true },
        metadata: checkoutMetadata,
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
                  display_name: "Standardversand",
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
                  display_name: "Expressversand",
                  delivery_estimate: {
                    minimum: { unit: "business_day", value: 7 },
                    maximum: { unit: "business_day", value: 10 },
                  },
                },
              },
            ],
          } as Stripe.Checkout.SessionCreateParams);

      let checkout;
      try {
        checkout = await stripeClient.checkout.sessions.create(
          sessionParams as Stripe.Checkout.SessionCreateParams,
          {
            idempotencyKey: `checkout_session_${createdPayment.id}`,
          },
        );
      } catch {
        await db.payment
          .update({
            where: { id: createdPayment.id },
            data: { status: "FAILED", cancelKey },
          })
          .catch(() => undefined);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }

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

      const userId = ctx.session?.user.id;
      const existingBookModuleIds = Array.from(
        new Set((existingBook?.modules ?? []).map((moduleItem) => moduleItem.moduleId)),
      );

      const combinedModules = await db.module.findMany({
        where: {
          deletedAt: null,
          OR: [
            ...(buildModuleFeedVisibilityWhere(userId).OR ?? []),
            ...(existingBookModuleIds.length > 0
              ? [{ id: { in: existingBookModuleIds } }]
              : []),
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
