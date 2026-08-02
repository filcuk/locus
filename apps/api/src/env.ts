import { z } from 'zod';

/** OpenFreeMap Liberty — default when MAP_STYLE_URL is unset (DESIGN §7 / §9). */
export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const EnvSchema = z.object({
  /** External Postgres; unset ⇒ embedded PGlite under the data root (DESIGN §7). */
  DATABASE_URL: z.string().min(1).optional(),
  SECRET_KEY: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('720h'),
  MEDIA_ROOT: z.string().min(1),
  MAP_STYLE_URL: z.string().url().default(DEFAULT_MAP_STYLE_URL),
  CORS_ORIGINS: z.string().default('*'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:8000'),
  PORT: z.coerce.number().int().positive().default(8000),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(1).optional(),
  NOTIFY_WEBHOOK_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Test helper — clears the memoised env so the next loadEnv() re-parses. */
export function resetEnvForTests(): void {
  cached = undefined;
}

/**
 * Zod-validated process.env. Call once at boot; fail fast on bad config.
 * No other module may read process.env directly.
 */
export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse({
    DATABASE_URL: emptyToUndefined(raw['DATABASE_URL']),
    SECRET_KEY: raw['SECRET_KEY'],
    ACCESS_TOKEN_TTL: emptyToUndefined(raw['ACCESS_TOKEN_TTL']),
    REFRESH_TOKEN_TTL: emptyToUndefined(raw['REFRESH_TOKEN_TTL']),
    MEDIA_ROOT: raw['MEDIA_ROOT'],
    MAP_STYLE_URL: emptyToUndefined(raw['MAP_STYLE_URL']),
    CORS_ORIGINS: emptyToUndefined(raw['CORS_ORIGINS']),
    PUBLIC_BASE_URL: emptyToUndefined(raw['PUBLIC_BASE_URL']),
    PORT: emptyToUndefined(raw['PORT']),
    SMTP_HOST: emptyToUndefined(raw['SMTP_HOST']),
    SMTP_PORT: emptyToUndefined(raw['SMTP_PORT']),
    SMTP_USER: emptyToUndefined(raw['SMTP_USER']),
    SMTP_PASSWORD: emptyToUndefined(raw['SMTP_PASSWORD']),
    SMTP_FROM: emptyToUndefined(raw['SMTP_FROM']),
    NOTIFY_WEBHOOK_URL: emptyToUndefined(raw['NOTIFY_WEBHOOK_URL']),
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }

  cached = parsed.data;
  return cached;
}

export function env(): Env {
  if (cached === undefined) {
    return loadEnv();
  }
  return cached;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return value;
}
