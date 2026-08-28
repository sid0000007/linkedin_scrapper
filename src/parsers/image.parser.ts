import type { LinkedInVectorImage } from '../models/linkedin.types';

export interface ParsedImage {
  url: string;
  width?: number;
  height?: number;
}

/** Picks the largest available artifact and joins it onto rootUrl for a usable image URL. */
export function parseImage(image: LinkedInVectorImage | undefined): ParsedImage | undefined {
  if (!image?.rootUrl || !image.artifacts?.length) {
    return undefined;
  }

  const largest = [...image.artifacts].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  if (!largest?.fileIdentifyingUrlPathSegment) {
    return undefined;
  }

  return {
    url: `${image.rootUrl}${largest.fileIdentifyingUrlPathSegment}`,
    width: largest.width,
    height: largest.height,
  };
}
