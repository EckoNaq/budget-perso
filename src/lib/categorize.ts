import { db } from '../db/db'
import type { Rule } from '../db/types'
import { AMBIGUOUS_SUPPLIERS } from '../db/seed'
import { normalize } from './text'

export interface CategoryMatch {
  category: string
  source: 'auto'
}

/**
 * Matching key for merchants: normalized + accents stripped, so that
 * "Intermarché" (new CSV `suggestedLabel`) matches the rule "intermarche"
 * (old `supplierFound`). Kept separate from the dedupe normalization.
 */
function matchKey(s: string): string {
  return normalize(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Find the best category for a transaction given the current rule set.
 *
 * Priority:
 *  1. Exact supplier match (normalized supplier === rule pattern)
 *  2. Word-boundary prefix supplier match (longest pattern wins)
 *  3. labelContains rules (longest pattern wins)
 *  4. null → awaiting validation
 */
export function matchCategory(
  rules: Rule[],
  supplier: string,
  label: string,
): CategoryMatch | null {
  const sup = matchKey(supplier)
  const lab = matchKey(label)

  if (sup) {
    const exact = rules.find((r) => r.matchType === 'supplier' && matchKey(r.pattern) === sup)
    if (exact) return exact.ambiguous ? null : { category: exact.category, source: 'auto' }

    const prefix = rules
      .filter((r) => r.matchType === 'supplier' && sup.startsWith(matchKey(r.pattern) + ' '))
      .sort((a, b) => b.pattern.length - a.pattern.length)[0]
    if (prefix) return prefix.ambiguous ? null : { category: prefix.category, source: 'auto' }
  }

  if (lab) {
    const contains = rules
      .filter((r) => r.matchType === 'labelContains' && lab.includes(matchKey(r.pattern)))
      .sort((a, b) => b.pattern.length - a.pattern.length)[0]
    if (contains) return { category: contains.category, source: 'auto' }
  }

  return null
}

/** Load all rules once (small table). */
export function loadRules(): Promise<Rule[]> {
  return db.rules.toArray()
}

/**
 * Learn from a user validation: remember that this merchant maps to this
 * category so future imports are pre-filled. Keyed on the supplier.
 */
export async function learnSupplierRule(supplier: string, category: string): Promise<void> {
  const pattern = matchKey(supplier)
  if (!pattern) return // nothing reliable to learn from
  const existing = await db.rules.where('pattern').equals(pattern).first()
  const now = Date.now()
  if (existing) {
    // Already flagged passthrough: keep it that way, never start guessing.
    if (existing.ambiguous) {
      await db.rules.update(existing.id!, { count: existing.count + 1, updatedAt: now })
      return
    }
    // Same merchant filed under a different category → it's ambiguous. Stop
    // auto-filling it from now on.
    if (existing.category && existing.category !== category) {
      await db.rules.update(existing.id!, {
        ambiguous: true,
        count: existing.count + 1,
        updatedAt: now,
      })
      return
    }
    await db.rules.update(existing.id!, {
      category,
      count: existing.count + 1,
      source: existing.source === 'starter' ? 'starter' : 'learned',
      updatedAt: now,
    })
  } else {
    await db.rules.add({
      matchType: 'supplier',
      pattern,
      category,
      count: 1,
      source: 'learned',
      updatedAt: now,
    })
  }
}

/**
 * Rebuild learned rules from the whole categorized history (e.g. after an
 * Excel import). A merchant filed consistently under one category becomes an
 * auto-fill rule; one used for ≥2 distinct categories (more than a one-off)
 * becomes ambiguous. Seeded passthrough merchants stay ambiguous.
 */
export async function rebuildLearnedRules(): Promise<void> {
  const ambiguousSeed = new Set(AMBIGUOUS_SUPPLIERS)
  const txs = await db.transactions.toArray()

  const bySupplier = new Map<string, Map<string, number>>()
  for (const t of txs) {
    if (!t.category) continue
    const sup = matchKey(t.supplier)
    if (!sup) continue
    if (!bySupplier.has(sup)) bySupplier.set(sup, new Map())
    const counts = bySupplier.get(sup)!
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1)
  }

  const existing = await db.rules.toArray()
  const byPattern = new Map(existing.map((r) => [r.pattern, r]))
  const now = Date.now()

  for (const [sup, counts] of bySupplier) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const [topCat, topCount] = ranked[0]
    const total = ranked.reduce((s, [, n]) => s + n, 0)
    // Ambiguous only if it's a seeded passthrough, or NO category clearly
    // dominates (top < 70%). So "Intermarché" 146×Courses + 2×autre stays
    // Courses, while a genuinely mixed merchant becomes ambiguous.
    const ambiguous = ambiguousSeed.has(sup) || topCount / total < 0.7
    const rule = byPattern.get(sup)
    const patch: Partial<Rule> = {
      matchType: 'supplier',
      pattern: sup,
      category: ambiguous ? (rule?.category ?? '') : topCat,
      ambiguous,
      count: Math.max(total, topCount),
      source: rule?.source === 'starter' ? 'starter' : 'learned',
      updatedAt: now,
    }
    if (rule) await db.rules.update(rule.id!, patch)
    else await db.rules.add(patch as Rule)
  }
}
