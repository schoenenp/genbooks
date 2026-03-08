import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";
import { env } from "@/env";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

// Ensure OAuth providers use a stable canonical origin in production.
if (env.NODE_ENV === "production" && !process.env.AUTH_URL) {
  process.env.AUTH_URL = trimTrailingSlash(env.BASE_APP_URL);
}

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
