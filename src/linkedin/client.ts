import type { Logger } from 'pino';
import { SessionAuth, type LinkedInAuth } from './auth';
import type { LinkedInRequestDescriptor } from './endpoints';
import { buildLinkedInHeaders } from './headers';
import { buildMeRequest } from './requests/me.request';
import { buildComponentRequest } from './requests/component.request';
import { buildProfilePageRequest } from './requests/profile-page.request';
import { logger as defaultLogger } from '../logger';
import {
  LinkedInAuthError,
  LinkedInError,
  LinkedInProfileNotFoundError,
  LinkedInRateLimitError,
  LinkedInUpstreamError,
} from '../errors/linkedin.errors';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;

type FetchLike = typeof fetch;

export interface LinkedInClientOptions {
  auth?: LinkedInAuth;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  maxConcurrent?: number;
  logger?: Logger;
}

/** Caps how many LinkedIn requests this process makes at once — separate from the
 * inbound rate limit on our own API (added in Phase 5). Protects the LinkedIn account
 * from being hammered by a burst of concurrent inbound requests. */
class Semaphore {
  private available: number;
  private readonly queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.available = concurrency;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.available -= 1;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.available += 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * When `LINKEDIN_LI_AT`/`LINKEDIN_JSESSIONID` are expired or invalid, LinkedIn doesn't
 * cleanly 401 — it bounces the request through a login/authwall redirect that can loop
 * until undici's fetch hits its own redirect cap, surfacing as a generic
 * `TypeError: fetch failed` with a "redirect count exceeded" cause. Detecting this
 * specifically avoids wasting the full retry budget (redirect loops are 100% cookie
 * problems, retrying with the same cookie just loops again) and gives a clear,
 * actionable error instead of a vague network failure.
 */
function isRedirectLoopError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /redirect/i.test(error.message) || /redirect/i.test((error.cause as Error | undefined)?.message ?? '');
}

export class LinkedInClient {
  private readonly auth: LinkedInAuth;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly semaphore: Semaphore;
  private readonly logger: Logger;

  constructor(options: LinkedInClientOptions = {}) {
    this.auth = options.auth ?? new SessionAuth();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.semaphore = new Semaphore(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT_REQUESTS);
    this.logger = options.logger ?? defaultLogger;
  }

  async getMe(): Promise<unknown> {
    return this.request(buildMeRequest(), 'me');
  }

  async getComponent(componentId: string, publicIdentifier: string): Promise<string> {
    const result = await this.request(buildComponentRequest(componentId, publicIdentifier), `${componentId}:${publicIdentifier}`);
    return result as string;
  }

  async getProfilePage(publicIdentifier: string): Promise<string> {
    const result = await this.request(buildProfilePageRequest(publicIdentifier), `profilePage:${publicIdentifier}`);
    return result as string;
  }

  private async request(descriptor: LinkedInRequestDescriptor, context: string): Promise<unknown> {
    const release = await this.semaphore.acquire();

    try {
      return await this.requestWithRetry(descriptor, context);
    } finally {
      release();
    }
  }

  private async requestWithRetry(
    descriptor: LinkedInRequestDescriptor,
    context: string,
    attempt = 0,
  ): Promise<unknown> {
    let response: Response;

    this.logger.debug({ context, attempt, url: descriptor.url }, 'Calling LinkedIn');

    try {
      response = await this.fetchWithTimeout(descriptor);
    } catch (error) {
      // Our own typed errors (e.g. SessionAuth throwing LinkedInAuthError while building
      // headers, before any network call happens) are config problems, not transient
      // network failures — never retry them, never mask them as LinkedInUpstreamError.
      if (error instanceof LinkedInError) {
        throw error;
      }

      if (isRedirectLoopError(error)) {
        this.logger.error({ context, err: error }, 'LinkedIn redirect loop — session cookie is almost certainly expired');
        throw new LinkedInAuthError(
          `LinkedIn redirected "${context}" in a loop instead of responding — this is what an expired/invalid session cookie looks like (LinkedIn bounces through its login/authwall rather than returning a clean 401). Re-extract LINKEDIN_LI_AT/LINKEDIN_JSESSIONID from a fresh browser login.`,
        );
      }

      if (attempt < this.maxRetries) {
        this.logger.warn({ context, attempt, err: error }, 'LinkedIn request failed, retrying');
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        return this.requestWithRetry(descriptor, context, attempt + 1);
      }
      this.logger.error({ context, attempts: attempt + 1, err: error }, 'LinkedIn request failed after retries');
      throw new LinkedInUpstreamError(
        `Network error calling LinkedIn for "${context}": ${(error as Error).message}`,
      );
    }

    if (response.ok) {
      this.logger.debug({ context, status: response.status }, 'LinkedIn request succeeded');
      return descriptor.responseType === 'text' ? response.text() : response.json();
    }

    if (response.status === 401 || response.status === 403) {
      this.logger.error({ context, status: response.status }, 'LinkedIn rejected our session');
      throw new LinkedInAuthError(
        `LinkedIn rejected the request (status ${response.status}) — session cookie is likely missing, expired, or invalid.`,
      );
    }

    if (response.status === 404) {
      this.logger.info({ context }, 'LinkedIn profile not found');
      throw new LinkedInProfileNotFoundError(`LinkedIn profile not found for "${context}".`);
    }

    // LinkedIn has historically used 999 as a bot-detection/blocked-request status
    // alongside the standard 429 — treat both as rate-limited.
    if (response.status === 429 || response.status === 999) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
      this.logger.warn({ context, status: response.status, retryAfterSeconds }, 'LinkedIn rate-limited us');
      throw new LinkedInRateLimitError(
        `LinkedIn rate-limited the request (status ${response.status}).`,
        retryAfterSeconds,
      );
    }

    if (response.status >= 500 && attempt < this.maxRetries) {
      this.logger.warn({ context, status: response.status, attempt }, 'LinkedIn upstream error, retrying');
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      return this.requestWithRetry(descriptor, context, attempt + 1);
    }

    this.logger.error({ context, status: response.status }, 'Unexpected LinkedIn response');
    throw new LinkedInUpstreamError(
      `Unexpected LinkedIn response (status ${response.status}) for "${context}".`,
      response.status,
    );
  }

  private async fetchWithTimeout(descriptor: LinkedInRequestDescriptor): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(descriptor.url, {
        method: descriptor.method,
        headers: buildLinkedInHeaders(this.auth, descriptor.method),
        body: descriptor.body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
