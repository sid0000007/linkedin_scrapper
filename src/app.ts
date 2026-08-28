import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { REDACT_PATHS } from './logger';
import { healthRoutes } from './routes/health.route';
import { dashboardRoutes } from './routes/dashboard.route';
import { buildProfileRoutes } from './routes/profile.route';
import { apiKeyAuth } from './middleware/api-key-auth';
import { errorHandler } from './middleware/error-handler';
import type { ProfileService } from './services/profile.service';

export interface BuildAppOptions {
  profileService?: ProfileService;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  app.setErrorHandler(errorHandler);

  // Health checks and the manual-test dashboard stay outside /v1 — no API key, no rate
  // limit. The dashboard page itself still requires the caller's API key client-side for
  // the actual POST /v1/profile call it makes.
  app.register(healthRoutes);
  app.register(dashboardRoutes);

  app.register(
    async (v1) => {
      await v1.register(rateLimit, {
        max: env.RATE_LIMIT_MAX,
        timeWindow: env.RATE_LIMIT_WINDOW_MS,
      });
      v1.addHook('onRequest', apiKeyAuth);
      await v1.register(buildProfileRoutes(options.profileService));
    },
    { prefix: '/v1' },
  );

  return app;
}
