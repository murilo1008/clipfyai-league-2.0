import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    OPENAI_API_KEY: z.string().min(1),
    // Todas as variáveis abaixo são opcionais de propósito: as features que dependem
    // delas são fail-closed (env vazia = acesso negado), então a ausência não pode
    // derrubar o boot/build da aplicação.
    LEAGUE_API_URL: z.string().url().default("http://localhost:3000"),
    LEAGUE_INTERNAL_API_KEY: z.string().optional(),
    DAILY_PAYOUT_BASE_URL: z.string().url().optional(),
    DAILY_PAYOUT_INTERNAL_KEY: z.string().optional(),
    YOUTUBE_LINK_SYNC_LOOKBACK_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),
    SOCIAL_INTEGRATIONS_ALLOWED_USER_IDS: z.string().optional(),
    SOCIAL_INTEGRATIONS_ALLOWED_EMAILS: z.string().optional(),
    MANUAL_METRICS_EXTRACTION_ALLOWED_USER_IDS: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z
      .string()
      .url()
      .default("https://league.clipfyai.com"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LEAGUE_API_URL: process.env.LEAGUE_API_URL,
    LEAGUE_INTERNAL_API_KEY: process.env.LEAGUE_INTERNAL_API_KEY,
    DAILY_PAYOUT_BASE_URL: process.env.DAILY_PAYOUT_BASE_URL,
    DAILY_PAYOUT_INTERNAL_KEY: process.env.DAILY_PAYOUT_INTERNAL_KEY,
    YOUTUBE_LINK_SYNC_LOOKBACK_DAYS:
      process.env.YOUTUBE_LINK_SYNC_LOOKBACK_DAYS,
    SOCIAL_INTEGRATIONS_ALLOWED_USER_IDS:
      process.env.SOCIAL_INTEGRATIONS_ALLOWED_USER_IDS,
    SOCIAL_INTEGRATIONS_ALLOWED_EMAILS:
      process.env.SOCIAL_INTEGRATIONS_ALLOWED_EMAILS,
    MANUAL_METRICS_EXTRACTION_ALLOWED_USER_IDS:
      process.env.MANUAL_METRICS_EXTRACTION_ALLOWED_USER_IDS,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
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
