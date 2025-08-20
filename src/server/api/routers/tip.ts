import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";

export const tipRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
  }),
  getCurrent: publicProcedure
  .input(z.object({
    tips: z.string().array()
  }))
  .query(({ctx, input}) => {
    const {tips} = input
    const {db} = ctx
    console.log(tips)
    return db.tooltip.findMany({
  where: {
    title: {
      in: tips
    }
  }
})
  }),
});
