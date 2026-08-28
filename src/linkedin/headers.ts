import type { LinkedInAuth } from './auth';
import type { LinkedInRequestDescriptor } from './endpoints';

/**
 * Fixed, non-secret headers every Voyager call needs, confirmed via live capture
 * in docs/RESEARCH.md. x-li-track is a static, plausible client-metadata blob — exact
 * values are not verified to matter, but the shape does.
 */
const STATIC_HEADERS: Record<string, string> = {
  accept: 'application/vnd.linkedin.normalized+json+2.1',
  'x-restli-protocol-version': '2.0.0',
  'x-li-lang': 'en_US',
  'x-li-track': JSON.stringify({
    clientVersion: '1.13.0',
    mpVersion: '1.13.0',
    osName: 'web',
    timezoneOffset: 0,
    timezone: 'UTC',
    deviceFormFactor: 'DESKTOP',
    mpName: 'voyager-web',
    displayDensity: 1,
    displayWidth: 1920,
    displayHeight: 1080,
  }),
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  referer: 'https://www.linkedin.com/',
};

export function buildLinkedInHeaders(
  auth: LinkedInAuth,
  method: LinkedInRequestDescriptor['method'] = 'GET',
): Record<string, string> {
  return {
    ...STATIC_HEADERS,
    ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    ...auth.getHeaders(),
  };
}
