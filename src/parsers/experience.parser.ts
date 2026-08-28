import { collectParagraphTexts, findComponentsByComponentKey } from '../flight/flight-parser';

export interface ParsedExperience {
  title?: string;
  companyName?: string;
  dateRangeText?: string;
  location?: string;
  description?: string;
}

const ENTITY_ITEM_PREFIX = 'entity-collection-item-';

/**
 * Walks a resolved Flight tree from the `profileCardsExperienceOnly` component response.
 * Confirmed shape (byte-verified, see docs/RESEARCH.md): each position is an
 * `entity-collection-item-*` node whose text nodes appear, in document order, as
 * title -> company/employment-type -> date range -> location -> (bullets...).
 */
export function parseExperience(tree: unknown): ParsedExperience[] {
  const items = findComponentsByComponentKey(tree, (key) => key.startsWith(ENTITY_ITEM_PREFIX));

  return items
    .map((item) => collectParagraphTexts(item))
    .filter((texts) => texts.length > 0)
    .map(([title, companyName, dateRangeText, location, ...bullets]) => ({
      title,
      companyName,
      dateRangeText,
      location,
      description: bullets.length ? bullets.join('\n') : undefined,
    }));
}
