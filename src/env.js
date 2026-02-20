import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    STRIPE_SECRET_KEY: z.string(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_CONNECT_THIN_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_SUBSCRIPTION_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_CONNECT_SUBSCRIPTION_PRICE_ID: z.string().optional(),
    STRIPE_CONNECT_APPLICATION_FEE_CENTS: z.string().optional(),
    STRIPE_CONNECT_COUNTRY: z.string().optional(),
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    EMAIL_SERVER_USER: z.string(),
    // AUTH_LINKEDIN_ID:z.string(),
    // AUTH_LINKEDIN_SECRET:z.string(),
    AUTH_GOOGLE_ID:z.string(),
    AUTH_GOOGLE_SECRET:z.string(),
    STRIPE_SUCCESS_URL: z.string().url(),
    STRIPE_CANCEL_URL: z.string().url(),
    BASE_APP_URL: z.string().url(),
    SPONSOR_LINK_SECRET: z.string().optional(),
    EMAIL_SERVER_PASSWORD: z.string(),
    EMAIL_SERVER_HOST: z.string(),
    EMAIL_FROM: z.string(),
    SHOP_EMAIL: z.string(),
    CANCEL_SECRET:z.string(),
    UPLOAD_URL_LINK: z.string(),
    UPLOAD_API_KEY: z.string(),
    GHOST_GRAYSCALE_API_KEY: z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CDN_SERVER_URL: z.string(),
    NEXT_PUBLIC_STRIPE_PUSHABLE_KEY: z.string(),

  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NEXT_PUBLIC_STRIPE_PUSHABLE_KEY:process.env.NEXT_PUBLIC_STRIPE_PUSHABLE_KEY,
    STRIPE_SECRET_KEY:process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_CONNECT_THIN_WEBHOOK_SECRET:
      process.env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET,
    STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:
      process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET,
    STRIPE_CONNECT_SUBSCRIPTION_PRICE_ID:
      process.env.STRIPE_CONNECT_SUBSCRIPTION_PRICE_ID,
    STRIPE_CONNECT_APPLICATION_FEE_CENTS:
      process.env.STRIPE_CONNECT_APPLICATION_FEE_CENTS,
    STRIPE_CONNECT_COUNTRY: process.env.STRIPE_CONNECT_COUNTRY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
    NEXT_PUBLIC_CDN_SERVER_URL:process.env.NEXT_PUBLIC_CDN_SERVER_URL,

    EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    UPLOAD_URL_LINK: process.env.UPLOAD_URL_LINK,
    UPLOAD_API_KEY: process.env.UPLOAD_API_KEY,
    GHOST_GRAYSCALE_API_KEY: process.env.GHOST_GRAYSCALE_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    // AUTH_LINKEDIN_ID: process.env.AUTH_LINKEDIN_ID,
    // AUTH_LINKEDIN_SECRET: process.env.AUTH_LINKEDIN_SECRET,
    SHOP_EMAIL: process.env.SHOP_EMAIL,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    CANCEL_SECRET: process.env.CANCEL_SECRET,
    STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL,
    STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL,
    BASE_APP_URL: process.env.BASE_APP_URL,
    SPONSOR_LINK_SECRET: process.env.SPONSOR_LINK_SECRET,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
