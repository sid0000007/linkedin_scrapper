import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { errorHandler } from '../../../src/middleware/error-handler';
import {
  InvalidLinkedInUrlError,
  LinkedInAuthError,
  LinkedInProfileNotFoundError,
  LinkedInRateLimitError,
  LinkedInUpstreamError,
} from '../../../src/errors/linkedin.errors';

function createMockReply() {
  const state: { status?: number; headers: Record<string, string>; body?: unknown } = { headers: {} };

  const reply = {
    code(status: number) {
      state.status = status;
      return reply;
    },
    header(name: string, value: string) {
      state.headers[name] = value;
      return reply;
    },
    send(body: unknown) {
      state.body = body;
      return reply;
    },
  } as unknown as FastifyReply;

  return { reply, state };
}

function createMockRequest(id = 'req-test-1') {
  return {
    id,
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as unknown as FastifyRequest;
}

function getZodError(): z.ZodError {
  try {
    z.string().parse(123);
  } catch (error) {
    return error as z.ZodError;
  }
  throw new Error('expected parse to throw');
}

describe('errorHandler', () => {
  it('maps ZodError to 400', () => {
    const { reply, state } = createMockReply();

    errorHandler(getZodError(), createMockRequest(), reply);

    expect(state.status).toBe(400);
    expect(state.body).toMatchObject({ error: { code: 'BAD_REQUEST', requestId: 'req-test-1' } });
  });

  it('maps InvalidLinkedInUrlError to 400 with the error message', () => {
    const { reply, state } = createMockReply();

    errorHandler(new InvalidLinkedInUrlError('bad url'), createMockRequest(), reply);

    expect(state.status).toBe(400);
    expect(state.body).toMatchObject({ error: { code: 'BAD_REQUEST', message: 'bad url' } });
  });

  it('maps LinkedInAuthError to 502', () => {
    const { reply, state } = createMockReply();

    errorHandler(new LinkedInAuthError('no session'), createMockRequest(), reply);

    expect(state.status).toBe(502);
    expect(state.body).toMatchObject({ error: { code: 'LINKEDIN_AUTH_ERROR' } });
  });

  it('maps LinkedInProfileNotFoundError to 404', () => {
    const { reply, state } = createMockReply();

    errorHandler(new LinkedInProfileNotFoundError('nope'), createMockRequest(), reply);

    expect(state.status).toBe(404);
    expect(state.body).toMatchObject({ error: { code: 'PROFILE_NOT_FOUND' } });
  });

  it('maps LinkedInRateLimitError to 429 and sets retry-after when known', () => {
    const { reply, state } = createMockReply();

    errorHandler(new LinkedInRateLimitError('slow down', 30), createMockRequest(), reply);

    expect(state.status).toBe(429);
    expect(state.headers['retry-after']).toBe('30');
    expect(state.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('maps LinkedInRateLimitError to 429 without a retry-after header when unknown', () => {
    const { reply, state } = createMockReply();

    errorHandler(new LinkedInRateLimitError('slow down'), createMockRequest(), reply);

    expect(state.status).toBe(429);
    expect(state.headers['retry-after']).toBeUndefined();
  });

  it('maps LinkedInUpstreamError to 502', () => {
    const { reply, state } = createMockReply();

    errorHandler(new LinkedInUpstreamError('weird response', 599), createMockRequest(), reply);

    expect(state.status).toBe(502);
    expect(state.body).toMatchObject({ error: { code: 'UPSTREAM_ERROR' } });
  });

  it('maps a Fastify-native 4xx error (e.g. malformed JSON body) to its own status code', () => {
    const { reply, state } = createMockReply();
    const fastifyError = Object.assign(new Error('Unexpected token in JSON'), { statusCode: 400 });

    errorHandler(fastifyError, createMockRequest(), reply);

    expect(state.status).toBe(400);
    expect(state.body).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });

  it('maps an unrecognized error to 500 without leaking its message', () => {
    const { reply, state } = createMockReply();

    errorHandler(new Error('some internal secret detail'), createMockRequest(), reply);

    expect(state.status).toBe(500);
    expect(state.body).toMatchObject({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
  });

  it('always includes the request id in the error body', () => {
    const { reply, state } = createMockReply();

    errorHandler(new LinkedInProfileNotFoundError('nope'), createMockRequest('req-unique-42'), reply);

    expect(state.body).toMatchObject({ error: { requestId: 'req-unique-42' } });
  });
});
