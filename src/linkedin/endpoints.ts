export const LINKEDIN_BASE_URL = 'https://www.linkedin.com';

export const LINKEDIN_ENDPOINTS = {
  me: '/voyager/api/me',
  component: '/flagship-web/rsc-action/actions/component',
  profilePage: '/in',
} as const;

/**
 * SDUI component IDs confirmed live (see docs/RESEARCH.md) via
 * `POST /flagship-web/rsc-action/actions/component?componentId=<id>&sduiid=<id>`.
 * Skills componentId is still not captured — that parser returns an empty array rather
 * than guessing at an ID.
 */
export const SDUI_COMPONENT_IDS = {
  experience: 'com.linkedin.sdui.generated.profile.dsl.impl.profileCardsExperienceOnly',
  educationAndCertifications: 'com.linkedin.sdui.generated.profile.dsl.impl.profileCardsBelowActivityPart1WithoutExp',
  languagesAndOrganizations: 'com.linkedin.sdui.generated.profile.dsl.impl.profileCardsBelowActivityPart4',
} as const;

export const SDUI_SCREEN_ID = 'com.linkedin.sdui.flagshipnav.profile.Profile';

export interface LinkedInRequestDescriptor {
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  responseType: 'json' | 'text';
}

export function buildUrl(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${LINKEDIN_BASE_URL}${path}?${query}` : `${LINKEDIN_BASE_URL}${path}`;
}
