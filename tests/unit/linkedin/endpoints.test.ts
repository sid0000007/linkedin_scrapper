import { describe, expect, it } from 'vitest';
import { buildUrl, LINKEDIN_BASE_URL, LINKEDIN_ENDPOINTS, SDUI_COMPONENT_IDS } from '../../../src/linkedin/endpoints';
import { buildComponentRequest } from '../../../src/linkedin/requests/component.request';
import { buildMeRequest } from '../../../src/linkedin/requests/me.request';
import { buildProfilePageRequest } from '../../../src/linkedin/requests/profile-page.request';

describe('buildUrl', () => {
  it('builds a URL with no params', () => {
    expect(buildUrl('/voyager/api/me')).toBe(`${LINKEDIN_BASE_URL}/voyager/api/me`);
  });

  it('builds a URL with query params', () => {
    const url = buildUrl('/flagship-web/rsc-action/actions/component', { componentId: 'x', sduiid: 'x' });

    expect(url).toBe(`${LINKEDIN_BASE_URL}/flagship-web/rsc-action/actions/component?componentId=x&sduiid=x`);
  });
});

describe('buildComponentRequest', () => {
  it('POSTs to the component dispatcher with componentId/sduiid query params and a JSON body', () => {
    const request = buildComponentRequest(SDUI_COMPONENT_IDS.experience, 'john-doe');

    expect(request.method).toBe('POST');
    expect(request.responseType).toBe('text');
    expect(request.url).toContain(LINKEDIN_ENDPOINTS.component);
    expect(request.url).toContain(`componentId=${encodeURIComponent(SDUI_COMPONENT_IDS.experience)}`);
    expect(request.url).toContain(`sduiid=${encodeURIComponent(SDUI_COMPONENT_IDS.experience)}`);
    expect(request.url).toContain('parentSpanId=');

    const body = JSON.parse(request.body ?? '{}');
    expect(body.clientArguments.payload).toEqual({ isSelfView: false, vanityName: 'john-doe' });
    expect(body.screenId).toBe('com.linkedin.sdui.flagshipnav.profile.Profile');
  });

  it('generates a different parentSpanId on each call', () => {
    const first = buildComponentRequest(SDUI_COMPONENT_IDS.experience, 'john-doe');
    const second = buildComponentRequest(SDUI_COMPONENT_IDS.experience, 'john-doe');

    expect(first.url).not.toBe(second.url);
  });
});

describe('buildMeRequest', () => {
  it('targets the /me endpoint', () => {
    const request = buildMeRequest();

    expect(request.url).toBe(`${LINKEDIN_BASE_URL}${LINKEDIN_ENDPOINTS.me}`);
    expect(request.responseType).toBe('json');
  });
});

describe('buildProfilePageRequest', () => {
  it('targets the public profile page and expects a text response', () => {
    const request = buildProfilePageRequest('john-doe');

    expect(request.method).toBe('GET');
    expect(request.url).toBe(`${LINKEDIN_BASE_URL}/in/john-doe/`);
    expect(request.responseType).toBe('text');
  });
});
