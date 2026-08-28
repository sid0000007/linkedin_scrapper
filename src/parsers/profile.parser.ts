import type { LinkedInMeResponse } from '../models/linkedin.types';
import { parseImage, type ParsedImage } from './image.parser';

export interface ParsedProfileTopCard {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  location?: string;
  publicIdentifier?: string;
  image?: ParsedImage;
  backgroundImage?: ParsedImage;
}

/**
 * `/voyager/api/me` only ever returns the *authenticated* user's own identity — there is
 * no vanityName-style parameter to target a different profile. Still useful for
 * self-view: gives a clean firstName/lastName split and sized profile/background images
 * that the HTML page doesn't provide as conveniently. See `parseHtmlTopCard` for the
 * general (any-profile) source.
 */
export function parseProfileTopCard(me: unknown): ParsedProfileTopCard {
  const response = me as LinkedInMeResponse;
  const miniProfileUrn = response?.data?.['*miniProfile'];
  const entity = response?.included?.find((item) => item.entityUrn === miniProfileUrn);

  if (!entity) return {};

  return {
    firstName: entity.firstName,
    lastName: entity.lastName,
    headline: entity.occupation,
    publicIdentifier: entity.publicIdentifier,
    image: parseImage(entity.picture),
    backgroundImage: parseImage(entity.backgroundImage),
  };
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(amp|#39|quot|lt|gt);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

/**
 * `GET /in/<publicIdentifier>/` server-renders top-card fields directly into the HTML —
 * confirmed real (byte-identical to a live capture, see docs/RESEARCH.md), works for any
 * public identifier unlike `/me`. Fields sit at a stable structural position identifiable
 * by `componentkey="...Topcard"`: an `<h2>` for the full name, then the first two `<p>`
 * tags for headline and current company/school summary (skipped), then a third `<p>` for
 * location. A fourth `<p>` (just "·") and a "Contact info" link follow but aren't used.
 */
export function parseHtmlTopCard(html: string): { fullName?: string; headline?: string; location?: string } {
  const markerIndex = html.search(/componentkey="[^"]*Topcard"/i);
  if (markerIndex === -1) return {};

  const slice = html.slice(markerIndex, markerIndex + 6000);
  const nameMatch = /<h2[^>]*>([^<]+)<\/h2>/i.exec(slice);
  const paragraphs = [...slice.matchAll(/<p[^>]*>([^<]+)<\/p>/gi)].map((m) => decodeHtmlEntities((m[1] ?? '').trim()));

  return {
    fullName: nameMatch?.[1] ? decodeHtmlEntities(nameMatch[1].trim()) : undefined,
    headline: paragraphs[0],
    location: paragraphs[2],
  };
}
