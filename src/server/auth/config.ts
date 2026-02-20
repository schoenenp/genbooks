import { PrismaAdapter } from "@auth/prisma-adapter";

import {
  type DefaultSession,
  type NextAuthConfig,
  type Session,
} from "next-auth";
import type { UserRole } from "@prisma/client";
import NodemailerProvider from "next-auth/providers/nodemailer";
import GoogleProvider from "next-auth/providers/google";
import { createTransport } from "nodemailer";
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
const trustHost = process.env.AUTH_TRUST_HOST === "true";
const smtpPort = env.EMAIL_SERVER_PORT;
const smtpSecure = smtpPort === 465;
const isProduction = env.NODE_ENV === "production";
const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const allowedAuthHosts = new Set(["planer.pirrot.de", "planer.pirrot.eu"]);
const verificationRateLimitWindowMs = 10 * 60 * 1000;
const verificationRateLimitMaxRequests = 5;
const verificationRateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isAllowedAuthHostname(hostname: string) {
  if (allowedAuthHosts.has(hostname)) return true;
  if (!isProduction && localhostHosts.has(hostname)) return true;
  return false;
}

function toAllowedOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (!isAllowedAuthHostname(hostname)) return null;

    if (localhostHosts.has(hostname)) {
      url.protocol = "http:";
      return url.origin;
    }

    url.protocol = "https:";
    url.port = "";
    return url.origin;
  } catch {
    return null;
  }
}

function getConfiguredAuthOrigin() {
  const configuredOrigins = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    env.BASE_APP_URL,
  ];

  for (const configuredOrigin of configuredOrigins) {
    if (!configuredOrigin) continue;

    const allowedOrigin = toAllowedOrigin(trimTrailingSlash(configuredOrigin));
    if (allowedOrigin) return allowedOrigin;
  }

  if (isProduction) {
    return "https://planer.pirrot.de";
  }

  return "http://127.0.0.1:3000";
}

function getRequestOrigin(request: Request): string | null {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost ?? request.headers.get("host")?.trim();
  if (!host) return null;

  try {
    const parsedHost = new URL(`http://${host}`);
    const hostname = parsedHost.hostname.toLowerCase();
    if (!isAllowedAuthHostname(hostname)) return null;

    if (localhostHosts.has(hostname)) {
      return `http://${parsedHost.host}`;
    }

    return `https://${hostname}`;
  } catch {
    return null;
  }
}

function getCallbackOrigin(url: URL): string | null {
  const callbackUrl = url.searchParams.get("callbackUrl");
  if (!callbackUrl) return null;

  try {
    const resolvedUrl = new URL(callbackUrl, `${url.protocol}//${url.host}`);
    return toAllowedOrigin(resolvedUrl.origin);
  } catch {
    return null;
  }
}

function getCanonicalAuthOrigin(request: Request, verificationUrl: URL): string {
  const callbackOrigin = getCallbackOrigin(verificationUrl);
  const requestOrigin = getRequestOrigin(request);

  if (callbackOrigin) return callbackOrigin;
  if (requestOrigin) return requestOrigin;

  return getConfiguredAuthOrigin();
}

function buildVerificationUrl(url: string, request: Request): string {
  const parsedUrl = new URL(url);
  const canonicalOrigin = new URL(getCanonicalAuthOrigin(request, parsedUrl));

  parsedUrl.protocol = canonicalOrigin.protocol;
  parsedUrl.host = canonicalOrigin.host;

  const callbackUrl = parsedUrl.searchParams.get("callbackUrl");
  if (callbackUrl) {
    try {
      const callbackTarget = new URL(callbackUrl, canonicalOrigin.origin);
      const safeCallbackOrigin =
        toAllowedOrigin(callbackTarget.origin) ?? canonicalOrigin.origin;
      const normalizedCallback = new URL(callbackTarget.toString());
      const normalizedOrigin = new URL(safeCallbackOrigin);

      normalizedCallback.protocol = normalizedOrigin.protocol;
      normalizedCallback.host = normalizedOrigin.host;

      parsedUrl.searchParams.set("callbackUrl", normalizedCallback.toString());
    } catch {
      parsedUrl.searchParams.set("callbackUrl", canonicalOrigin.origin);
    }
  }

  return parsedUrl.toString();
}

function verificationEmailText(params: { host: string; url: string }) {
  return `Sign in to ${params.host}\n${params.url}\n\nIf you did not request this email, you can ignore it.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function verificationEmailHtml(params: { host: string; url: string }) {
  const safeHost = escapeHtml(params.host).replace(/\./g, "&#8203;.");
  const safeUrl = escapeHtml(params.url);
  return `
<body style="font-family:Helvetica,Arial,sans-serif;background:#f4f4f5;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <h2 style="margin:0 0 12px 0;color:#18181b;">Sign in to ${safeHost}</h2>
    <p style="margin:0 0 20px 0;color:#3f3f46;">Use the button below to complete your sign-in.</p>
    <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Sign in</a>
    <p style="margin:20px 0 0 0;color:#71717a;font-size:13px;line-height:1.5;">
      If the button does not work, copy and paste this URL into your browser:<br />
      <span style="word-break:break-all;">${safeUrl}</span>
    </p>
  </div>
</body>`;
}

function getRequesterIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

function pruneVerificationRateLimits(now: number) {
  for (const [key, entry] of verificationRateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      verificationRateLimitStore.delete(key);
    }
  }
}

function enforceVerificationRateLimit(request: Request, identifier: string) {
  const now = Date.now();
  pruneVerificationRateLimits(now);

  const ip = getRequesterIp(request);
  const key = `${ip}:${identifier.toLowerCase()}`;
  const existing = verificationRateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    verificationRateLimitStore.set(key, {
      count: 1,
      resetAt: now + verificationRateLimitWindowMs,
    });
    return;
  }

  if (existing.count >= verificationRateLimitMaxRequests) {
    throw new Error(
      "Too many sign-in email requests. Please wait a few minutes and try again.",
    );
  }

  existing.count += 1;
  verificationRateLimitStore.set(key, existing);
}

function getSafeRedirectTarget(url: string, baseUrl: string) {
  const safeBaseOrigin = toAllowedOrigin(baseUrl) ?? getConfiguredAuthOrigin();

  try {
    const targetUrl = new URL(url, safeBaseOrigin);
    const safeTargetOrigin = toAllowedOrigin(targetUrl.origin);
    if (!safeTargetOrigin) return safeBaseOrigin;

    return `${safeTargetOrigin}${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  } catch {
    return safeBaseOrigin;
  }
}

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
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: env.EMAIL_SERVER_USER,
          pass: env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, provider, request, url }) {
        enforceVerificationRateLimit(request, identifier);

        const verificationUrl = buildVerificationUrl(url, request);
        const host = new URL(verificationUrl).host;
        const transport = createTransport(provider.server);

        const result = await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Sign in to ${host}`,
          text: verificationEmailText({ host, url: verificationUrl }),
          html: verificationEmailHtml({ host, url: verificationUrl }),
        });

        const failedRecipients = [
          ...(result.rejected ?? []),
          ...(result.pending ?? []),
        ].map(String);

        if (failedRecipients.length > 0) {
          throw new Error(
            `Failed to send verification email to: ${failedRecipients.join(", ")}`,
          );
        }
      },
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
    redirect: ({ url, baseUrl }) => getSafeRedirectTarget(url, baseUrl),
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
