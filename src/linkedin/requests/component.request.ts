import { randomBytes } from 'node:crypto';
import { buildUrl, LINKEDIN_ENDPOINTS, SDUI_SCREEN_ID, type LinkedInRequestDescriptor } from '../endpoints';

/**
 * `parentSpanId` is a per-request tracing token in real browser traffic — unconfirmed
 * whether LinkedIn validates it server-side (see docs/RESEARCH.md), so a fresh random
 * token per call mimics real client behavior rather than risking a suspicious fixed value.
 */
function generateSpanId(): string {
  return randomBytes(9).toString('base64');
}

/**
 * Builds a request for LinkedIn's SDUI async-component dispatcher — the confirmed real
 * mechanism for fetching Experience/Education/Certifications data (see
 * docs/RESEARCH.md). One generic POST endpoint, parameterized by componentId; the same
 * request body shape works for every component.
 */
export function buildComponentRequest(componentId: string, publicIdentifier: string): LinkedInRequestDescriptor {
  const body = {
    clientArguments: {
      payload: { isSelfView: false, vanityName: publicIdentifier },
      states: [],
      knownTemplateIds: [],
    },
    requestMetadata: { $type: 'proto.sdui.common.RequestMetadata' },
    screenId: SDUI_SCREEN_ID,
  };

  return {
    method: 'POST',
    url: buildUrl(LINKEDIN_ENDPOINTS.component, {
      componentId,
      sduiid: componentId,
      parentSpanId: generateSpanId(),
    }),
    body: JSON.stringify(body),
    responseType: 'text',
  };
}
