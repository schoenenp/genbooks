import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

export const bookRouter = createTRPCRouter({
  updateInfo: protectedProcedure
  .input(z.object({
    id: z.string().optional(),
    name: z.string().nullable(),
    sub: z.string().optional().nullable(),
    region: z.string().nullable(),
    period: z.object({
      start:z.string(),
      end:z.string().optional()
    })
  }))
  .mutation( async ({ctx, input}) => {
    if(!ctx.session.user){
      return
    }
    const { name, sub, period, region } = input

    const {start:planStart, end:planEnd} = period

    const start = new Date(planStart)
    const end = planEnd ? new Date(planEnd) : new Date()

    return ctx.db.book.update({
      where:{
        id: input.id,
      },
      data:{
        bookTitle: name,
        subTitle: sub,
        planStart:start,
        planEnd: end,
        region,
      }
    })
  }),
  updatePlannerName: protectedProcedure
  .input(z.object({
    id: z.string(),
    name: z.string()
  }))
  .mutation(async({ctx, input}) => {
    const {id, name} = input
    return ctx.db.book.update({
      where:{
        id,
      },
      data:{
        name
      }
    })
  }),
  saveBookModules: publicProcedure
  .input(z.object({
    bookId: z.string(),
    modules: z.object({
      id: z.string(),
      idx: z.number(),
      colorCode: z
      .number()
      .refine((val) => val === 1 || val === 4, {
        message: "Color code must be either 1 (grayscale) or 4 (color)"
      }).optional()
    }).array()
  }))
  .mutation(async ({ctx, input}) => {
    const {bookId, modules:bookModules} = input



    await ctx.db.book.update({
      where: { id: bookId },
      data: {
        modules: {
          deleteMany: {},
        }
      }
    });

    return ctx.db.book.update({
      where:{
        id:bookId
      },
      data:{
        createdBy: ctx.session?.user.id ? {
          connect: {
            id: ctx.session.user.id
          }
        } : undefined,
        modules:{
          createMany:{
            data:bookModules.map(
              m => ({
              idx:m.idx,
              moduleId:m.id,
              colorCode: m.colorCode 
              ? m.colorCode == 4 
              ? "COLOR" 
              : "GRAYSCALE" 
              : undefined
            }))
          }
        }
      }
    })
  }),
  getUserBooks: protectedProcedure
  .query(({ctx}) => {
    const {db, session} = ctx
    return db.book.findMany({
      where:{
        createdById: session.user.id,
        deletedAt: null
      },
      include:{
        modules:true
      }
    })
  }),
  getById: publicProcedure
  .input(z.object({
    id: z.string().optional()
  }))
  .query(({ctx, input}) => {
    const {id} = input
    
    const {db} = ctx
    return id ? db.book.findUnique({
      where:{ id, deletedAt: null },
      include:{
        modules:true
      }
    }) : null
  }),
  init: publicProcedure
    .input(z.object({ 
      name: z.string().min(1).optional(),
      sub:z.string().min(1).optional(),
      region: z.string(),
      planStart: z.string(),
      planEnd: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {

      const { name, sub, planStart, planEnd, region } = input
      const start = new Date(planStart)
      const end = new Date(planEnd)

      const random8Digit = Math.floor(10000000 + Math.random() * 90000000)

      return ctx.db.book.create({
        data: {
         name:`Planer-${random8Digit}`,
         bookTitle: name,
         subTitle: sub,
         planStart:start,
         planEnd: end,
         region,
         createdById: ctx.session?.user ? ctx.session.user.id : undefined
        }
      });
    }),
    delete: protectedProcedure
    .input(z.object({
      bookId:z.string()
    }))
    .mutation(({ctx, input}) => {
      return ctx.db.book.update({
        where:{
          id: input.bookId,
        },
        data:{
          deletedAt: new Date()
        }
      })

    })
});