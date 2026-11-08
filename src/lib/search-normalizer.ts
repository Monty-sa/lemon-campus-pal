/**
 * Arabic-aware text normalizer for search and filtering.
 *
 * Requirements (LEMON-029):
 * 1. Ignore tashkeel (diacritics) and tatweel (kashida).
 * 2. Normalize Alef variants: أ, إ, آ, ٱ -> ا.
 * 3. Normalize Alef Maksura to Yeh: ى -> ي.
 * 4. Handle common spelling variants conservatively (ة -> ه, ىء -> ئ).
 * 5. Case-insensitive Latin/English matching.
 * 6. Preserves CRNs, course codes, and numeric identifiers.
 */

const TASHKEEL_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL_REGEX = /\u0640/g;
const ALEF_VARIANTS_REGEX = /[أإآٱ]/g;

export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return "";

  return text
    // 1. Remove diacritics / tashkeel
    .replace(TASHKEEL_REGEX, "")
    // 2. Remove tatweel / kashida
    .replace(TATWEEL_REGEX, "")
    // 3. Normalize Alef variants to bare Alif
    .replace(ALEF_VARIANTS_REGEX, "ا")
    // 4. Normalize common hamza variant: ىء -> ئ
    .replace(/ىء/g, "ئ")
    // 5. Normalize Alef Maksura to Yeh
    .replace(/ى/g, "ي")
    // 6. Normalize Teh Marbuta to Heh
    .replace(/ة/g, "ه")
    // 7. English lowercase
    .toLowerCase()
    // 8. Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether haystack matches query using Arabic-aware normalization.
 * Supports multi-token searches (all tokens must be present in haystack).
 */
export function matchesSearchText(
  haystack: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;
  if (!haystack) return false;

  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return true;

  // Direct substring check
  if (normalizedHaystack.includes(normalizedQuery)) {
    return true;
  }

  // Multi-token check: every word in query must match
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (queryTokens.length > 1) {
    return queryTokens.every((token) => normalizedHaystack.includes(token));
  }

  return false;
}
