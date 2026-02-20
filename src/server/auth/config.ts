import { PrismaAdapter } from "@auth/prisma-adapter";

import {
  type DefaultSession,
  type NextAuthConfig,
  type Session,
} from "next-auth";
import type { UserRole } from "@prisma/client";
import NodemailerProvider from "next-auth/providers/nodemailer";
import GoogleProvider from "next-auth/providers/google";
// import LinkedinProvider from "next-auth/providers/linkedin";

import { db } from "@/server/db";
import { env } from "@/env";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
const adapter = PrismaAdapter(db as never);
const trustHost =
  process.env.AUTH_TRUST_HOST === undefined
    ? true
    : process.env.AUTH_TRUST_HOST === "true";

export const authConfig = {
  trustHost,
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
  },
  providers: [
    NodemailerProvider({
      server: {
        host: env.EMAIL_SERVER_HOST,
        port: 465,
        auth: {
          user: env.EMAIL_SERVER_USER,
          pass: env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
    // LinkedinProvider({
    //   clientId: env.AUTH_LINKEDIN_ID as string,
    //   clientSecret: env.AUTH_LINKEDIN_SECRET as string,
    // }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter,
  callbacks: {
    session: ({
      session,
      user,
    }: {
      session: Session;
      user: { id: string; role: UserRole };
    }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        role: user.role ?? "USER",
      },
    }),
  },
} as NextAuthConfig;
