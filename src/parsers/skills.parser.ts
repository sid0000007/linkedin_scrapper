export interface ParsedSkill {
  name?: string;
  endorsementCount?: number;
}

/**
 * No componentId for a Skills SDUI section has been captured yet — see docs/RESEARCH.md
 * ("Still not captured"). Returns empty rather than guessing at an unconfirmed shape.
 */
export function parseSkills(): ParsedSkill[] {
  return [];
}
