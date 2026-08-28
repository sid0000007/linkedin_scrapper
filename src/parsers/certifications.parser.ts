import { collectParagraphTexts, findComponentsByComponentKey, findSectionByKeySuffix } from '../flight/flight-parser';

export interface ParsedCertification {
  name?: string;
  authority?: string;
  issuedText?: string;
  credentialIdText?: string;
}

const SECTION_SUFFIX = 'CertificationTopLevel';
const ENTITY_ITEM_PREFIX = 'entity-collection-item-';

/**
 * ⚠️ Positional order (name -> issuer -> issued-date -> credential-id) is inferred from
 * the same title->subtitle->date pattern confirmed for Experience/Education, NOT
 * independently byte-verified — the only real capture we have of this response is
 * truncated before any Certification entries are defined (see docs/RESEARCH.md's
 * correction note). Needs confirming against a real profile that has certifications.
 */
export function parseCertifications(tree: unknown): ParsedCertification[] {
  const section = findSectionByKeySuffix(tree, SECTION_SUFFIX);
  if (!section) return [];

  const items = findComponentsByComponentKey(section, (key) => key.startsWith(ENTITY_ITEM_PREFIX));
  const entries = items.length > 0 ? items.map((item) => collectParagraphTexts(item)) : [collectParagraphTexts(section)];

  return entries
    .filter((texts) => texts.length > 0)
    .map(([name, authority, issuedText, credentialIdText]) => ({ name, authority, issuedText, credentialIdText }));
}
