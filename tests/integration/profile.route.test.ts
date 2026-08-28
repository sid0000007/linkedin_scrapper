import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { env } from '../../src/config/env';
import { ProfileService } from '../../src/services/profile.service';
import type { ProfileDataSource } from '../../src/services/linkedin.service';
import { LinkedInProfileNotFoundError } from '../../src/errors/linkedin.errors';
import meFixture from '../fixtures/me-response.sample.json';

const API_KEY = 'test-api-key';
const PROFILE_URL = 'https://www.linkedin.com/in/jordan-rivera-example/';

const PROFILE_PAGE_HTML = readFileSync(new URL('../fixtures/topcard-page.synthetic.html', import.meta.url), 'utf-8');
const EXPERIENCE_BODY = readFileSync(new URL('../fixtures/flight/experience-response.synthetic.txt', import.meta.url), 'utf-8');
const EDU_CERT_BODY = readFileSync(
  new URL('../fixtures/flight/education-certifications-response.synthetic.txt', import.meta.url),
  'utf-8',
);
const EMPTY_FLIGHT_BODY = '0:["$","div",null,{"children":[]}]\n';

function buildTestApp(dataSource: ProfileDataSource) {
  return buildApp({ profileService: new ProfileService(dataSource) });
}

const okDataSource: ProfileDataSource = {
  getProfileSources: async () => ({
    me: meFixture,
    profilePage: PROFILE_PAGE_HTML,
    experience: EXPERIENCE_BODY,
    educationAndCertifications: EDU_CERT_BODY,
    languagesAndOrganizations: EMPTY_FLIGHT_BODY,
  }),
};

describe('POST /v1/profile', () => {
  beforeAll(() => {
    env.API_KEY = API_KEY;
  });

  afterAll(() => {
    env.API_KEY = undefined;
  });

  it('returns a normalized profile for a valid request with a valid API key', async () => {
    const app = buildTestApp(okDataSource);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile',
      headers: { 'x-api-key': API_KEY },
      payload: { url: PROFILE_URL },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name.fullName).toBe('Jordan Rivera');
    expect(body.experience).toHaveLength(2);

    await app.close();
  });

  it('rejects requests with a missing API key', async () => {
    const app = buildTestApp(okDataSource);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile',
      payload: { url: PROFILE_URL },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('rejects requests with a wrong API key', async () => {
    const app = buildTestApp(okDataSource);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile',
      headers: { 'x-api-key': 'wrong-key' },
      payload: { url: PROFILE_URL },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 400 for a malformed body', async () => {
    const app = buildTestApp(okDataSource);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile',
      headers: { 'x-api-key': API_KEY },
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 for a non-profile LinkedIn URL', async () => {
    const app = buildTestApp(okDataSource);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile',
      headers: { 'x-api-key': API_KEY },
      payload: { url: 'https://www.linkedin.com/company/example/' },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('returns 404 when the profile is not found upstream', async () => {
    const app = buildTestApp({
      getProfileSources: async () => {
        throw new LinkedInProfileNotFoundError('not found');
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile',
      headers: { 'x-api-key': API_KEY },
      payload: { url: 'https://www.linkedin.com/in/nobody/' },
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('trips the rate limit after exceeding the configured max', async () => {
    const previousMax = env.RATE_LIMIT_MAX;
    env.RATE_LIMIT_MAX = 2;

    const app = buildTestApp(okDataSource);

    const makeRequest = () =>
      app.inject({
        method: 'POST',
        url: '/v1/profile',
        headers: { 'x-api-key': API_KEY },
        payload: { url: PROFILE_URL },
      });

    await makeRequest();
    await makeRequest();
    const third = await makeRequest();

    expect(third.statusCode).toBe(429);

    env.RATE_LIMIT_MAX = previousMax;
    await app.close();
  });

  it('/healthz works without an API key', async () => {
    const app = buildTestApp(okDataSource);

    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
