import { collectParagraphTexts, findComponentsByComponentKey, findSectionByKeySuffix } from '../flight/flight-parser';

export interface ParsedLanguage {
  name?: string;
  proficiency?: string;
}

const SECTION_SUFFIX = 'LanguageTopLevel';
const ENTITY_ITEM_PREFIX = 'entity-collection-item-';

/**
 * Walks a resolved Flight tree from the `profileCardsBelowActivityPart4` component
 * response (confirmed live, see docs/RESEARCH.md — combined with Organizations in the
 * same response). ⚠️ Positional order (name → proficiency) is inferred by analogy with
 * Experience/Education's title→subtitle pattern, not independently byte-verified — the
 * only real capture available has an empty Languages section (no languages listed on that
 * profile), confirming the componentId and section suffix but not field values.
 */
export function parseLanguages(tree: unknown): ParsedLanguage[] {
  const section = findSectionByKeySuffix(tree, SECTION_SUFFIX);
  if (!section) return [];

  const items = findComponentsByComponentKey(section, (key) => key.startsWith(ENTITY_ITEM_PREFIX));
  const entries = items.length > 0 ? items.map((item) => collectParagraphTexts(item)) : [collectParagraphTexts(section)];

  return entries
    .filter((texts) => texts.length > 0)
    .map(([name, proficiency]) => ({ name, proficiency }));
}
