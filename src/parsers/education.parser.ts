import { collectParagraphTexts, findComponentsByComponentKey, findSectionByKeySuffix } from '../flight/flight-parser';

export interface ParsedEducation {
  schoolName?: string;
  degreeName?: string;
}

const SECTION_SUFFIX = 'EducationTopLevelSection';
const ENTITY_ITEM_PREFIX = 'entity-collection-item-';

/**
 * Walks a resolved Flight tree from the `profileCardsBelowActivityPart1WithoutExp`
 * component response. Confirmed shape (byte-verified, see docs/RESEARCH.md): school name
 * then degree name appear as the first two text nodes, in document order, per entry.
 * Multi-entry profiles are expected to wrap each entry in an `entity-collection-item-*`
 * node (the same pattern confirmed for Experience); a profile with exactly one education
 * entry doesn't get that wrapper, so this falls back to treating the whole section as a
 * single entry when no item wrapper is found.
 */
export function parseEducation(tree: unknown): ParsedEducation[] {
  const section = findSectionByKeySuffix(tree, SECTION_SUFFIX);
  if (!section) return [];

  const items = findComponentsByComponentKey(section, (key) => key.startsWith(ENTITY_ITEM_PREFIX));
  const entries = items.length > 0 ? items.map((item) => collectParagraphTexts(item)) : [collectParagraphTexts(section)];

  return entries
    .filter((texts) => texts.length > 0)
    .map(([schoolName, degreeName]) => ({ schoolName, degreeName }));
}
