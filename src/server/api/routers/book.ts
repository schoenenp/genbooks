import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

export const bookRouter = createTRPCRouter({
  updateInfo: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().nullable(),
        sub: z.string().optional().nullable(),
        region: z.string().nullable(),
        period: z.object({
          start: z.string(),
          end: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user) {
        return;
      }
      const { name, sub, period, region } = input;

      const { start: planStart, end: planEnd } = period;

      const start = new Date(planStart);
      const end = planEnd ? new Date(planEnd) : new Date();

      return ctx.db.book.update({
        where: {
          id: input.id,
        },
        data: {
          bookTitle: name,
          subTitle: sub,
          planStart: start,
          planEnd: end,
          region,
        },
      });
    }),
  updatePlannerName: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      return ctx.db.book.update({
        where: {
          id,
        },
        data: {
          name,
        },
      });
    }),
  saveBookModules: publicProcedure
    .input(
      z.object({
        bookId: z.string(),
        modules: z
          .object({
            id: z.string(),
            idx: z.number(),
            colorCode: z
              .number()
              .refine((val) => val === 1 || val === 4, {
                message: "Color code must be either 1 (grayscale) or 4 (color)",
              })
              .optional(),
          })
          .array(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { bookId, modules: bookModules } = input;

      await ctx.db.book.update({
        where: { id: bookId },
        data: {
          modules: {
            deleteMany: {},
          },
        },
      });

      return ctx.db.book.update({
        where: {
          id: bookId,
        },
        data: {
          createdBy: ctx.session?.user.id
            ? {
                connect: {
                  id: ctx.session.user.id,
                },
              }
            : undefined,
          modules: {
            createMany: {
              data: bookModules.map((m) => ({
                idx: m.idx,
                moduleId: m.id,
                colorCode: m.colorCode
                  ? m.colorCode === 4
                    ? "COLOR"
                    : "GRAYSCALE"
                  : undefined,
              })),
            },
          },
        },
      });
    }),
  getUserBooks: protectedProcedure.query(({ ctx }) => {
    const { db, session } = ctx;
    return db.book.findMany({
      where: {
        createdById: session.user.id,
        deletedAt: null,
      },
      include: {
        modules: true,
      },
    });
  }),
  toggleTemplate: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        isTemplate: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { bookId, isTemplate } = input;
      const user = ctx.session.user as {
        id: string;
        role: "ADMIN" | "STAFF" | "MODERATOR" | "USER";
      };

      // Check role
      if (
        user.role !== "ADMIN" &&
        user.role !== "STAFF" &&
        user.role !== "MODERATOR"
      ) {
        throw new Error("Unauthorized");
      }

      return ctx.db.book.update({
        where: { id: bookId },
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
        data: { isTemplate } as any,
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
      });
    }),
  getById: publicProcedure
    .input(
      z.object({
        id: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const { id } = input;

      const { db } = ctx;
      return id
        ? db.book.findUnique({
            where: { id, deletedAt: null },
            include: {
              modules: true,
              customDates: true,
            },
          })
        : null;
    }),
  saveCustomDates: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        dates: z.array(
          z.object({
            date: z.string(), // ISO string
            name: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { bookId, dates } = input;

      // Transaction: Delete old dates, create new ones
      return ctx.db.$transaction(async (tx) => {
        // 1. Delete existing dates
        await tx.customDate.deleteMany({
          where: { bookId },
        });

        // 2. Create new dates if any
        if (dates.length > 0) {
          await tx.customDate.createMany({
            data: dates.map((d) => ({
              bookId,
              date: new Date(d.date),
              name: d.name,
            })),
          });
        }
      });
    }),
  init: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        sub: z.string().min(1).optional(),
        region: z.string(),
        planStart: z.string(),
        planEnd: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { name, sub, planStart, planEnd, region } = input;
      const start = new Date(planStart);
      const end = new Date(planEnd);

      const random8Digit = Math.floor(10000000 + Math.random() * 90000000);

      return ctx.db.book.create({
        data: {
          name: `Planer-${random8Digit}`,
          bookTitle: name,
          subTitle: sub,
          planStart: start,
          planEnd: end,
          region,
          createdById: ctx.session?.user ? ctx.session.user.id : undefined,
        },
      });
    }),
  delete: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.book.update({
        where: {
          id: input.bookId,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }),
  getTemplates: publicProcedure.query(async ({ ctx }) => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    return ctx.db.book.findMany({
      where: {
        isTemplate: true,
        deletedAt: null,
      } as any,
      include: {
        modules: {
          include: {
            module: {
              include: {
                files: true,
              },
            },
          },
        },
      },
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
  }),
  cloneTemplate: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.book.findUnique({
        where: { id: input.templateId },
        include: {
          modules: true,
        },
      });

      if (!template) {
        throw new Error("Template not found");
      }

      const random8Digit = Math.floor(10000000 + Math.random() * 90000000);

      // Deep copy logic
      return ctx.db.book.create({
        data: {
          name: `Copy-${template.name}-${random8Digit}`,
          bookTitle: template.bookTitle,
          subTitle: template.subTitle,
          format: template.format,
          region: template.region,
          planStart: template.planStart,
          planEnd: template.planEnd,
          copyFromId: template.id,
          // Link new modules
          modules: {
            create: template.modules.map((m) => ({
              idx: m.idx,
              moduleId: m.moduleId,
              colorCode: m.colorCode,
            })),
          },
          // Assign to current user if logged in
          createdById: ctx.session?.user ? ctx.session.user.id : undefined,
        },
      });
    }),
});
