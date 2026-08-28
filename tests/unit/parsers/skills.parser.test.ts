import { describe, expect, it } from 'vitest';
import { parseSkills } from '../../../src/parsers/skills.parser';

describe('parseSkills', () => {
  it('returns an empty array — no Skills SDUI componentId has been captured yet (see docs/RESEARCH.md)', () => {
    expect(parseSkills()).toEqual([]);
  });
});
