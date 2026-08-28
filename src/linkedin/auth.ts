import { env } from '../config/env';
import { LinkedInAuthError } from '../errors/linkedin.errors';

export interface LinkedInAuth {
  /** Headers that must be attached to every Voyager request, including cookie + csrf-token. */
  getHeaders(): Record<string, string>;
}

/**
 * csrf-token must equal the JSESSIONID cookie value with its surrounding quotes
 * stripped — confirmed empirically in docs/RESEARCH.md against a live LinkedIn request.
 */
function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, '');
}

export class SessionAuth implements LinkedInAuth {
  getHeaders(): Record<string, string> {
    const liAt = env.LINKEDIN_LI_AT;
    const jsessionId = env.LINKEDIN_JSESSIONID;

    if (!liAt || !jsessionId) {
      throw new LinkedInAuthError(
        'LinkedIn session is not configured — set LINKEDIN_LI_AT and LINKEDIN_JSESSIONID (see README for how to extract them).',
      );
    }

    const csrfToken = stripQuotes(jsessionId);

    return {
      cookie: `li_at=${liAt}; JSESSIONID="${csrfToken}"`,
      'csrf-token': csrfToken,
    };
  }
}
