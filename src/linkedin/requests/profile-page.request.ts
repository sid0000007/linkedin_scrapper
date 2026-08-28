import { buildUrl, LINKEDIN_ENDPOINTS, type LinkedInRequestDescriptor } from '../endpoints';

/**
 * The public profile page itself — `GET /in/<publicIdentifier>/`. Confirmed (see
 * docs/RESEARCH.md) to server-render top-card fields (name, headline, location) directly
 * into the HTML, in a stable structural position identifiable by the
 * `componentkey="...Topcard"` attribute — no Flight-stream parsing needed for these
 * fields. This works for any public identifier, unlike `/voyager/api/me`.
 */
export function buildProfilePageRequest(publicIdentifier: string): LinkedInRequestDescriptor {
  return {
    method: 'GET',
    url: buildUrl(`${LINKEDIN_ENDPOINTS.profilePage}/${publicIdentifier}/`),
    responseType: 'text',
  };
}
