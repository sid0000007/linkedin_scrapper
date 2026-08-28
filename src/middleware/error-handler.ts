import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  InvalidLinkedInUrlError,
  LinkedInAuthError,
  LinkedInProfileNotFoundError,
  LinkedInRateLimitError,
  LinkedInUpstreamError,
} from '../errors/linkedin.errors';

function sendError(reply: FastifyReply, status: number, code: string, message: string, requestId: string): void {
  reply.code(status).send({ error: { code, message, requestId } });
}

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply): void {
  const requestId = request.id;

  if (error instanceof ZodError) {
    sendError(reply, 400, 'BAD_REQUEST', 'Invalid request body.', requestId);
    return;
  }

  if (error instanceof InvalidLinkedInUrlError) {
    sendError(reply, 400, 'BAD_REQUEST', error.message, requestId);
    return;
  }

  if (error instanceof LinkedInAuthError) {
    request.log.error({ err: error }, 'LinkedIn session auth failed');
    sendError(reply, 502, 'LINKEDIN_AUTH_ERROR', 'Upstream LinkedIn authentication failed.', requestId);
    return;
  }

  if (error instanceof LinkedInProfileNotFoundError) {
    sendError(reply, 404, 'PROFILE_NOT_FOUND', 'LinkedIn profile not found.', requestId);
    return;
  }

  if (error instanceof LinkedInRateLimitError) {
    if (error.retryAfterSeconds) {
      reply.header('retry-after', String(error.retryAfterSeconds));
    }
    sendError(reply, 429, 'RATE_LIMITED', 'LinkedIn rate-limited this request. Try again later.', requestId);
    return;
  }

  if (error instanceof LinkedInUpstreamError) {
    request.log.error({ err: error }, 'Unexpected LinkedIn upstream error');
    sendError(reply, 502, 'UPSTREAM_ERROR', 'LinkedIn returned an unexpected response.', requestId);
    return;
  }

  // Fastify's own validation/parsing errors (e.g. malformed JSON body) carry a 4xx statusCode.
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    sendError(reply, statusCode, 'BAD_REQUEST', error.message, requestId);
    return;
  }

  request.log.error({ err: error }, 'Unhandled error');
  sendError(reply, 500, 'INTERNAL_ERROR', 'Something went wrong.', requestId);
}
