import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../src/config/env';
import { SessionAuth } from '../../../src/linkedin/auth';
import { LinkedInAuthError } from '../../../src/errors/linkedin.errors';

describe('SessionAuth', () => {
  afterEach(() => {
    env.LINKEDIN_LI_AT = undefined;
    env.LINKEDIN_JSESSIONID = undefined;
  });

  it('throws LinkedInAuthError when cookies are not configured', () => {
    const auth = new SessionAuth();

    expect(() => auth.getHeaders()).toThrow(LinkedInAuthError);
  });

  it('derives csrf-token from the unquoted JSESSIONID value', () => {
    env.LINKEDIN_LI_AT = 'fake-li-at-value';
    env.LINKEDIN_JSESSIONID = '"ajax:1234567890"';

    const auth = new SessionAuth();
    const headers = auth.getHeaders();

    expect(headers['csrf-token']).toBe('ajax:1234567890');
    expect(headers.cookie).toContain('li_at=fake-li-at-value');
    expect(headers.cookie).toContain('JSESSIONID="ajax:1234567890"');
  });
});
