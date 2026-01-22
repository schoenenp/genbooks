import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  getMyRole: protectedProcedure.query(async ({ ctx }) => {
    const { session } = ctx;
    const user = session.user as {
      id: string;
      role: "ADMIN" | "STAFF" | "MODERATOR" | "USER";
    };
    return {
      role: user.role,
    };
  }),
});
