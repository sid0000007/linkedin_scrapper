import pino from 'pino';
import { env } from './config/env';

/**
 * Shared with Fastify's own logger options in app.ts so both the HTTP-layer logger and
 * this standalone one (used by LinkedInClient, which has no Fastify request context)
 * apply the same redaction. Defense in depth — nothing in this codebase currently logs a
 * full headers object, but this guards against it being added later by mistake.
 */
export const REDACT_PATHS = [
  'cookie',
  'headers.cookie',
  'headers["x-api-key"]',
  'headers["csrf-token"]',
  'headers.authorization',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
