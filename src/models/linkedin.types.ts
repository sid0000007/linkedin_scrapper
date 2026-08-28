/**
 * Shapes for LinkedIn's raw responses. Two genuinely different formats are in play here
 * (see docs/RESEARCH.md):
 *  - `/voyager/api/me`: classic Voyager `data`/`included[]` URN graph. Confirmed live.
 *  - The SDUI component POSTs (Experience, Education/Certifications): a React Server
 *    Components "Flight" stream — walked via `src/flight/flight-parser.ts`, not typed
 *    here as a static interface since its shape is a resolved `unknown` tree.
 */

export interface LinkedInVectorArtifact {
  width?: number;
  height?: number;
  fileIdentifyingUrlPathSegment?: string;
}

export interface LinkedInVectorImage {
  rootUrl?: string;
  artifacts?: LinkedInVectorArtifact[];
}

export interface LinkedInMiniProfileEntity {
  entityUrn?: string;
  firstName?: string;
  lastName?: string;
  occupation?: string;
  publicIdentifier?: string;
  picture?: LinkedInVectorImage;
  backgroundImage?: LinkedInVectorImage;
  [key: string]: unknown;
}

export interface LinkedInMeResponse {
  data?: {
    '*miniProfile'?: string;
    [key: string]: unknown;
  };
  included?: LinkedInMiniProfileEntity[];
}
