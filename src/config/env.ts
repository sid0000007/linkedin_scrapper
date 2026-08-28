import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // LinkedIn session cookies — obtained via manual browser login (see README).
  // Deliberately optional here: health checks and most tests must work without them.
  // Absence is enforced at the point of use (SessionAuth) as a typed LinkedInAuthError,
  // not as a process-startup crash — see src/linkedin/auth.ts.
  LINKEDIN_LI_AT: z.string().min(1).optional(),
  LINKEDIN_JSESSIONID: z.string().min(1).optional(),

  // Protects the public endpoint from being hammered (which would burn the LinkedIn
  // account above). Optional here for the same lazy-validation reason as the LinkedIn
  // cookies — enforced at the point of use in src/middleware/api-key-auth.ts.
  API_KEY: z.string().min(1).optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }

  return parsed.data;
}

export const env = loadEnv();
