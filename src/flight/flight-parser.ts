/**
 * Parser for LinkedIn's SDUI wire format: React Server Components "Flight" stream text.
 * Confirmed shape (see docs/RESEARCH.md) — newline-separated `<chunkId>:<payload>` lines,
 * where payload is either a module reference (`I[...]`, ignorable plumbing) or a JSON
 * value. String values shaped `"$L<chunkId>"` are lazy references, resolved recursively.
 * Element nodes are `["$", "<tag>", "<key>", {props}]`; the actual field text LinkedIn
 * renders lives in the `children` of resolved `["$","p",null,{...}]` nodes.
 */

const CHUNK_LINE_PATTERN = /^([0-9a-zA-Z]+):(.*)$/;
const LAZY_REF_PATTERN = /^\$L([0-9a-zA-Z]+)$/;

export type FlightElement = [string, unknown, unknown, Record<string, unknown> | undefined];

/** Splits a Flight stream response body into a map of chunkId -> parsed JSON payload.
 * Module-reference lines (`I[...]`) parse fine too since stripping the leading `I` leaves
 * valid JSON — callers walk from chunk `"0"` so these never get visited unless referenced. */
export function parseFlightChunks(body: string): Map<string, unknown> {
  const chunks = new Map<string, unknown>();

  for (const line of body.split('\n')) {
    if (!line.trim()) continue;

    const match = CHUNK_LINE_PATTERN.exec(line);
    if (!match) continue;

    const [, chunkId = '', rest = ''] = match;
    const payload = rest.startsWith('I') ? rest.slice(1) : rest;

    try {
      chunks.set(chunkId, JSON.parse(payload));
    } catch {
      // Not a confirmed shape — skip rather than throw; parsers must degrade gracefully.
      continue;
    }
  }

  return chunks;
}

/** Recursively replaces `"$L<chunkId>"` references with the referenced chunk's resolved
 * value. Memoizes by chunkId (a chunk always resolves to the same value everywhere it's
 * referenced) and tracks in-progress chunks to bail out of cycles instead of hanging. */
export function resolveFlightNode(
  node: unknown,
  chunks: Map<string, unknown>,
  cache: Map<string, unknown> = new Map(),
  inProgress: Set<string> = new Set(),
): unknown {
  if (typeof node === 'string') {
    const match = LAZY_REF_PATTERN.exec(node);
    if (!match) return node;

    const [, chunkId = ''] = match;
    if (cache.has(chunkId)) return cache.get(chunkId);
    if (inProgress.has(chunkId) || !chunks.has(chunkId)) return node;

    inProgress.add(chunkId);
    const resolved = resolveFlightNode(chunks.get(chunkId), chunks, cache, inProgress);
    inProgress.delete(chunkId);
    cache.set(chunkId, resolved);
    return resolved;
  }

  if (Array.isArray(node)) {
    return node.map((item) => resolveFlightNode(item, chunks, cache, inProgress));
  }

  if (node && typeof node === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      resolved[key] = resolveFlightNode(value, chunks, cache, inProgress);
    }
    return resolved;
  }

  return node;
}

/** Parses a full Flight response body and returns the fully-resolved tree starting from
 * chunk `"0"` — confirmed to always be the root for every captured SDUI component response. */
export function parseFlightResponse(body: string): unknown {
  const chunks = parseFlightChunks(body);
  return resolveFlightNode(chunks.get('0'), chunks);
}

export function isFlightElement(node: unknown): node is FlightElement {
  return Array.isArray(node) && node.length === 4 && node[0] === '$';
}

/** DFS over the resolved tree, collecting every element node whose `props.componentKey`
 * satisfies `predicate` — this is how LinkedIn tags both repeated collection items
 * (`entity-collection-item-*` confirmed for Experience entries, matched by prefix) and
 * named section roots (`...EducationTopLevelSection`/`...CertificationTopLevel`, matched
 * by suffix since the prefix contains a per-profile URN hash). */
export function findComponentsByComponentKey(
  node: unknown,
  predicate: (componentKey: string) => boolean,
  results: FlightElement[] = [],
): FlightElement[] {
  if (isFlightElement(node)) {
    const componentKey = node[3]?.componentKey;
    if (typeof componentKey === 'string' && predicate(componentKey)) {
      results.push(node);
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) findComponentsByComponentKey(item, predicate, results);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      findComponentsByComponentKey(value, predicate, results);
    }
  }

  return results;
}

/** Finds a named section root by componentKey suffix (the prefix is a per-profile URN
 * hash, e.g. `com.linkedin.sdui.profile.card.refACoAA...EducationTopLevelSection`, so
 * matching only the stable suffix is what generalizes across profiles). */
export function findSectionByKeySuffix(tree: unknown, suffix: string): FlightElement | undefined {
  return findComponentsByComponentKey(tree, (key) => key.endsWith(suffix))[0];
}

function flattenToText(children: unknown): string | undefined {
  if (typeof children === 'string') return children;

  if (Array.isArray(children)) {
    const text = children.filter((child): child is string => typeof child === 'string').join('');
    return text || undefined;
  }

  return undefined;
}

/** DFS over the resolved tree, collecting the text content of every text-bearing element
 * in document order — the confirmed locations of job titles, companies, date ranges,
 * locations, degree names, and bullet text (see docs/RESEARCH.md's extraction rule).
 * Two confirmed shapes hold text:
 *   - a literal `<p>` element: `["$","p",null,{"children": "text" | ["text"]}]`
 *   - a Text-primitive wrapper component (tag resolves to a module descriptor, not "p"):
 *     `["$", <module>, null, {"textProps": {"children": ["text"]}, ...}]`
 * Does not descend into a matched element's own subtree — nothing further to find there. */
export function collectParagraphTexts(node: unknown, results: string[] = []): string[] {
  if (isFlightElement(node)) {
    const props = node[3];
    const text = node[1] === 'p' ? flattenToText(props?.children) : flattenToText((props?.textProps as Record<string, unknown> | undefined)?.children);

    if (text) {
      results.push(text);
      return results;
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) collectParagraphTexts(item, results);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectParagraphTexts(value, results);
    }
  }

  return results;
}
