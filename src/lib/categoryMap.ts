import { CATEGORY_NAMES } from '../db/seed'

/**
 * Normalization key: lowercase, strip accents, collapse any punctuation/space
 * runs to a single space. So "Electricité / Gaz", "electricité / gaz" and
 * "Electricite/Gaz" all map to the same key.
 */
function key(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

let lookup: Map<string, string> | null = null

function getLookup(): Map<string, string> {
  if (!lookup) {
    lookup = new Map()
    for (const name of CATEGORY_NAMES()) lookup.set(key(name), name)
  }
  return lookup
}

/**
 * Return the canonical category name for a raw label from the Excel, or null
 * if it isn't one of the user's categories (in which case the row is ignored).
 */
export function canonicalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null
  return getLookup().get(key(raw)) ?? null
}
