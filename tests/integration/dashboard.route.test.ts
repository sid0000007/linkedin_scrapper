import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';

describe('GET /', () => {
  it('serves the dashboard HTML without requiring an API key', async () => {
    const app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('POST /v1/profile');

    await app.close();
  });
});
