import { buildUrl, LINKEDIN_ENDPOINTS, type LinkedInRequestDescriptor } from '../endpoints';

/** Identity-check call — useful for validating a session is authenticated. */
export function buildMeRequest(): LinkedInRequestDescriptor {
  return {
    method: 'GET',
    url: buildUrl(LINKEDIN_ENDPOINTS.me),
    responseType: 'json',
  };
}
