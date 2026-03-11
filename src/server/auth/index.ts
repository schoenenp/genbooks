import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalhostOrigin(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return localhostHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function sanitizeAuthOriginEnv() {
  const runningInProduction = process.env.NODE_ENV === "production";
  
  // Only sanitize in production - local dev needs the URLs
  if (!runningInProduction) return;

  if (isLocalhostOrigin(process.env.AUTH_URL)) {
    process.env.AUTH_URL = undefined;
  }
  if (isLocalhostOrigin(process.env.NEXTAUTH_URL)) {
    process.env.NEXTAUTH_URL = undefined;
  }
}

sanitizeAuthOriginEnv();

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
