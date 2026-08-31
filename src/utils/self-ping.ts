export const SELF_PING_INTERVAL_MS = 5 * 60_000;

/** Subset of pino's/Fastify's logger interface — accepts either without a hard dependency. */
export interface SelfPingLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export interface SelfPingOptions {
  url?: string;
  logger: SelfPingLogger;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
}

/**
 * Render's free tier spins the service down after ~15 minutes idle. Pinging our own
 * /healthz every 5 minutes keeps it warm. No-ops when no URL is configured (local
 * dev/test) so this never fires against nothing.
 */
export function startSelfPing(options: SelfPingOptions): () => void {
  const { url, logger, fetchImpl = fetch, intervalMs = SELF_PING_INTERVAL_MS } = options;

  if (!url) {
    logger.debug('Self-ping disabled — no SELF_URL/RENDER_EXTERNAL_URL configured');
    return () => undefined;
  }

  const target = new URL('/healthz', url).toString();

  const ping = (): void => {
    fetchImpl(target)
      .then((response) => {
        logger.debug({ target, status: response.status }, 'Self-ping succeeded');
      })
      .catch((error) => {
        logger.warn({ target, err: error }, 'Self-ping failed');
      });
  };

  const interval = setInterval(ping, intervalMs);
  interval.unref();

  logger.info({ target, intervalMs }, 'Self-ping started');

  return () => clearInterval(interval);
}
