import { describe, expect, it, vi } from 'vitest';
import { LinkedInClient } from '../../../src/linkedin/client';
import {
  LinkedInAuthError,
  LinkedInProfileNotFoundError,
  LinkedInRateLimitError,
  LinkedInUpstreamError,
} from '../../../src/errors/linkedin.errors';
import type { LinkedInAuth } from '../../../src/linkedin/auth';

const stubAuth: LinkedInAuth = {
  getHeaders: () => ({ cookie: 'li_at=fake; JSESSIONID="ajax:fake"', 'csrf-token': 'ajax:fake' }),
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => body,
  } as unknown as Response;
}

describe('LinkedInClient.getMe', () => {
  it('returns parsed JSON on a successful response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    const result = await client.getMe();

    expect(result).toEqual({ data: { ok: true } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps 401 to LinkedInAuthError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    await expect(client.getMe()).rejects.toBeInstanceOf(LinkedInAuthError);
  });

  it('maps 404 to LinkedInProfileNotFoundError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    await expect(client.getMe()).rejects.toBeInstanceOf(LinkedInProfileNotFoundError);
  });

  it('maps 429 to LinkedInRateLimitError and reads retry-after', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 429, { 'retry-after': '30' }));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    const error = await client.getMe().catch((e) => e);

    expect(error).toBeInstanceOf(LinkedInRateLimitError);
    expect((error as LinkedInRateLimitError).retryAfterSeconds).toBe(30);
  });

  it('retries on 5xx then throws LinkedInUpstreamError after exhausting retries', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl, maxRetries: 1 });

    const error = await client.getMe().catch((e) => e);

    expect(error).toBeInstanceOf(LinkedInUpstreamError);
    expect((error as LinkedInUpstreamError).statusCode).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries on network error then throws LinkedInUpstreamError after exhausting retries', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl, maxRetries: 1 });

    await expect(client.getMe()).rejects.toBeInstanceOf(LinkedInUpstreamError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps a redirect-loop network error to LinkedInAuthError without retrying (expired-cookie signature)', async () => {
    const redirectError = new TypeError('fetch failed', { cause: new Error('redirect count exceeded') });
    const fetchImpl = vi.fn().mockRejectedValue(redirectError);
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl, maxRetries: 2 });

    await expect(client.getMe()).rejects.toBeInstanceOf(LinkedInAuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('propagates LinkedInAuthError thrown while building headers without retrying or wrapping it', async () => {
    const fetchImpl = vi.fn();
    const throwingAuth: LinkedInAuth = {
      getHeaders: () => {
        throw new LinkedInAuthError('session not configured');
      },
    };
    const client = new LinkedInClient({ auth: throwingAuth, fetchImpl, maxRetries: 2 });

    await expect(client.getMe()).rejects.toBeInstanceOf(LinkedInAuthError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not retry on 4xx errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl, maxRetries: 2 });

    await client.getMe().catch(() => undefined);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('LinkedInClient.getComponent', () => {
  it('POSTs to the component dispatcher and returns raw text (Flight stream, not JSON)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('0:["$","div",null,{}]\n'));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    const result = await client.getComponent('com.linkedin.sdui.generated.profile.dsl.impl.profileCardsExperienceOnly', 'john-doe');

    expect(result).toBe('0:["$","div",null,{}]\n');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('flagship-web/rsc-action/actions/component');
    expect(url).toContain('componentId=com.linkedin.sdui.generated.profile.dsl.impl.profileCardsExperienceOnly');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body).clientArguments.payload.vanityName).toBe('john-doe');
  });

  it('maps a 404 the same way as getMe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('', 404));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    await expect(client.getComponent('anyComponentId', 'john-doe')).rejects.toBeInstanceOf(LinkedInProfileNotFoundError);
  });
});

describe('LinkedInClient.getProfilePage', () => {
  it('GETs the public profile page and returns raw HTML text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('<html>...</html>'));
    const client = new LinkedInClient({ auth: stubAuth, fetchImpl });

    const result = await client.getProfilePage('john-doe');

    expect(result).toBe('<html>...</html>');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://www.linkedin.com/in/john-doe/');
    expect(init.method).toBe('GET');
  });
});
