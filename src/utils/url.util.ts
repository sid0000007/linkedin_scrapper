import { InvalidLinkedInUrlError } from '../errors/linkedin.errors';

// Matches /in/<identifier> and allows trailing path segments
// (e.g. /in/john-doe/details/experience/), but nothing else — /company/, /jobs/,
// /posts/, /school/, etc. are rejected.
const PROFILE_PATH_PATTERN = /^\/in\/([^/]+)/;

export function extractPublicIdentifier(rawUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new InvalidLinkedInUrlError(`"${rawUrl}" is not a valid URL.`);
  }

  const host = parsed.hostname.replace(/^www\./, '');
  if (host !== 'linkedin.com') {
    throw new InvalidLinkedInUrlError(`"${rawUrl}" is not a linkedin.com URL.`);
  }

  const match = parsed.pathname.match(PROFILE_PATH_PATTERN);
  if (!match?.[1]) {
    throw new InvalidLinkedInUrlError(
      `"${rawUrl}" does not look like a member profile URL (expected linkedin.com/in/<identifier>).`,
    );
  }

  return decodeURIComponent(match[1]);
}
