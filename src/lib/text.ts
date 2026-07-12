/** Normalize a merchant/label for matching: lowercase + collapse whitespace. */
export function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse a French/Boursorama amount into a number.
 * Handles: "-141,83", "3 270,49", "-1 200,00", "1 234,56", non-breaking spaces.
 */
export function parseAmount(raw: string): number {
  if (raw == null) return NaN
  const cleaned = String(raw)
    .replace(/[  \s]/g, '') // all kinds of spaces (thousands sep)
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

/** Format a number as EUR, French style. */
export function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}
