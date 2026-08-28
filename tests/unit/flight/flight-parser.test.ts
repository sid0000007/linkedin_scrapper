import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  collectParagraphTexts,
  findComponentsByComponentKey,
  findSectionByKeySuffix,
  parseFlightChunks,
  parseFlightResponse,
  resolveFlightNode,
} from '../../../src/flight/flight-parser';

const EXPERIENCE_REAL_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/experience-response.real.txt', import.meta.url),
  'utf-8',
);
const EDU_CERT_REAL_FIXTURE = readFileSync(
  new URL('../../fixtures/flight/education-certifications-response.real.txt', import.meta.url),
  'utf-8',
);

describe('parseFlightChunks', () => {
  it('splits chunk lines into an id -> payload map', () => {
    const chunks = parseFlightChunks('0:["$","div",null,{"children":"hi"}]\n1:["hash",[],"default"]\n');

    expect(chunks.get('0')).toEqual(['$', 'div', null, { children: 'hi' }]);
    expect(chunks.get('1')).toEqual(['hash', [], 'default']);
  });

  it('skips blank lines and lines with unparseable payloads without throwing', () => {
    const chunks = parseFlightChunks('0:["$","div",null,{}]\n\n1:not valid json\n');

    expect(chunks.size).toBe(1);
    expect(chunks.has('1')).toBe(false);
  });
});

describe('resolveFlightNode', () => {
  it('resolves a $L reference to its target chunk, recursively', () => {
    const chunks = new Map<string, unknown>([
      ['0', ['$', 'div', null, { children: '$L1' }]],
      ['1', ['$', 'p', null, { children: ['hello'] }]],
    ]);

    const resolved = resolveFlightNode(chunks.get('0'), chunks) as unknown[];

    expect(resolved).toEqual(['$', 'div', null, { children: ['$', 'p', null, { children: ['hello'] }] }]);
  });

  it('leaves an unresolvable reference (missing chunk) as-is instead of throwing', () => {
    const chunks = new Map<string, unknown>([['0', ['$', 'div', null, { children: '$L99' }]]]);

    const resolved = resolveFlightNode(chunks.get('0'), chunks) as [string, string, null, { children: string }];

    expect(resolved[3].children).toBe('$L99');
  });

  it('bails out of a self-referencing cycle instead of hanging', () => {
    const chunks = new Map<string, unknown>([['0', '$L0']]);

    expect(resolveFlightNode(chunks.get('0'), chunks)).toBe('$L0');
  });

  it('memoizes so the same chunk resolves consistently when referenced multiple times', () => {
    const chunks = new Map<string, unknown>([
      ['0', ['$', 'div', null, { children: ['$L1', '$L1'] }]],
      ['1', ['$', 'p', null, { children: ['shared'] }]],
    ]);

    const resolved = resolveFlightNode(chunks.get('0'), chunks) as [string, string, null, { children: unknown[] }];

    expect(resolved[3].children[0]).toEqual(resolved[3].children[1]);
  });
});

describe('parseFlightResponse', () => {
  it('parses and resolves a full response body starting from chunk 0', () => {
    const body = '0:["$","p",null,{"children":["$L1"]}]\n1:"hello"\n';

    expect(parseFlightResponse(body)).toEqual(['$', 'p', null, { children: ['hello'] }]);
  });
});

describe('findComponentsByComponentKey', () => {
  it('finds every element whose componentKey satisfies the predicate, at any depth', () => {
    const tree = [
      '$',
      'div',
      null,
      {
        children: [
          ['$', 'div', null, { componentKey: 'entity-collection-item-a' }],
          ['$', 'div', null, { componentKey: 'other' }],
          ['$', 'div', null, { componentKey: 'entity-collection-item-b' }],
        ],
      },
    ];

    const matches = findComponentsByComponentKey(tree, (key) => key.startsWith('entity-collection-item-'));

    expect(matches.map((m) => m[3]?.componentKey)).toEqual(['entity-collection-item-a', 'entity-collection-item-b']);
  });
});

describe('findSectionByKeySuffix', () => {
  it('finds a section root by componentKey suffix, ignoring the per-profile URN prefix', () => {
    const tree = ['$', 'div', null, { children: ['$', 'div', null, { componentKey: 'com.linkedin.sdui.profile.card.refHASHEducationTopLevelSection' }] }];

    expect(findSectionByKeySuffix(tree, 'EducationTopLevelSection')?.[3]?.componentKey).toBe(
      'com.linkedin.sdui.profile.card.refHASHEducationTopLevelSection',
    );
  });

  it('returns undefined when no section matches', () => {
    expect(findSectionByKeySuffix(['$', 'div', null, {}], 'Nope')).toBeUndefined();
  });
});

describe('collectParagraphTexts', () => {
  it('collects text from literal <p> elements in document order', () => {
    const tree = ['$', 'div', null, { children: [['$', 'p', null, { children: ['first'] }], ['$', 'p', null, { children: ['second'] }]] }];

    expect(collectParagraphTexts(tree)).toEqual(['first', 'second']);
  });

  it('collects text from Text-primitive wrappers via props.textProps.children', () => {
    const tree = ['$', '$L18', null, { textProps: { children: ['wrapped text'] } }];

    expect(collectParagraphTexts(tree)).toEqual(['wrapped text']);
  });

  it('returns an empty array for a tree with no text-bearing nodes', () => {
    expect(collectParagraphTexts(['$', 'div', null, { children: [] }])).toEqual([]);
  });
});

describe('against real, byte-verified captures (see docs/RESEARCH.md)', () => {
  it('extracts the real Cybership experience entry exactly as captured', () => {
    const tree = parseFlightResponse(EXPERIENCE_REAL_FIXTURE);
    const items = findComponentsByComponentKey(tree, (key) => key.startsWith('entity-collection-item-'));

    expect(items).toHaveLength(3);
    expect(collectParagraphTexts(items[0])).toEqual([
      'Full Stack Engineer ( contract )',
      'Cybership · Full-time',
      'Feb 2025 - Jun 2026 · 1 yr 5 mos',
      'Kansas, United States · Remote',
    ]);
  });

  it('degrades to an empty text list for entries whose chunks were not captured, rather than throwing', () => {
    const tree = parseFlightResponse(EXPERIENCE_REAL_FIXTURE);
    const items = findComponentsByComponentKey(tree, (key) => key.startsWith('entity-collection-item-'));

    expect(collectParagraphTexts(items[1])).toEqual([]);
    expect(collectParagraphTexts(items[2])).toEqual([]);
  });

  it('parses each individually well-formed chunk line of the education capture even though the overall tree has a corrupted link', () => {
    const chunks = parseFlightChunks(EDU_CERT_REAL_FIXTURE);

    expect(chunks.get('1c')).toEqual([
      '$',
      'p',
      null,
      expect.objectContaining({ children: ['University School of Information, Communication & Technology (USICT)'] }),
    ]);
    expect(chunks.get('1e')).toEqual(['$', 'p', null, expect.objectContaining({ children: ['Bachelor of Technology - BTech, Computer Science'] })]);
    // Chunk 6 (the section's content root) has a genuine bracket mismatch in this capture.
    expect(chunks.has('6')).toBe(false);
  });

  it('degrades gracefully (no throw) when resolving the corrupted education/certifications capture', () => {
    expect(() => parseFlightResponse(EDU_CERT_REAL_FIXTURE)).not.toThrow();
  });
});
