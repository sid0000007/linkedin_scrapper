export interface NormalizedDateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * LinkedIn's SDUI responses give a single pre-formatted display string
 * (e.g. `"Feb 2025 - Jun 2026 · 1 yr 5 mos"`, `"Mar 2021 - Present"`) rather than
 * structured `{month, year}` fields. Rather than risk a fragile month-name-to-number
 * conversion with no real edge-case data to test it against, this keeps LinkedIn's own
 * display text for each side of the range — still human-readable, just not strict ISO.
 * See README's known limitations.
 */
export function parseDateRangeText(text: string | undefined): NormalizedDateRange {
  if (!text) return {};

  const [rangePart = ''] = text.split('·').map((part) => part.trim());
  const [startDate, endDate] = rangePart.split(' - ').map((part) => part.trim());

  return {
    startDate: startDate || undefined,
    endDate: !endDate || endDate === 'Present' ? undefined : endDate,
  };
}

const ISSUED_PREFIX_PATTERN = /^Issued\s+/i;

/** `"Issued Sep 2024"` -> `"Sep 2024"`. */
export function parseIssuedText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text.replace(ISSUED_PREFIX_PATTERN, '').trim() || undefined;
}
