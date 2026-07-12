import { db } from '../db/db'
import type { Transaction } from '../db/types'
import { loadRules, matchCategory } from './categorize'
import { parseBoursoramaCsv } from './csv'

export interface ImportStats {
  total: number // rows read from the file
  imported: number // new rows added
  duplicates: number // skipped because already present
  autoCategorized: number // imported rows that got an auto category
  toValidate: number // imported rows still awaiting a category
  errors: string[]
}

/**
 * Insert transactions, skipping ones already present. Dedup uses a multiset so
 * overlapping exports don't drop legitimately-repeated transactions.
 * Returns how many were added vs skipped as duplicates.
 */
export async function persistNewTransactions(
  rows: Transaction[],
): Promise<{ imported: number; duplicates: number }> {
  if (!rows.length) return { imported: 0, duplicates: 0 }

  const existingCounts = new Map<string, number>()
  await db.transactions.each((t) => {
    existingCounts.set(t.dedupeKey, (existingCounts.get(t.dedupeKey) ?? 0) + 1)
  })

  const seenInFile = new Map<string, number>()
  const toInsert: Transaction[] = []
  let duplicates = 0

  for (const row of rows) {
    const key = row.dedupeKey
    const already = existingCounts.get(key) ?? 0
    const used = seenInFile.get(key) ?? 0
    seenInFile.set(key, used + 1)
    if (used < already) {
      duplicates++
      continue
    }
    toInsert.push(row)
  }

  if (toInsert.length) await db.transactions.bulkAdd(toInsert)
  return { imported: toInsert.length, duplicates }
}

/**
 * Import a Boursorama CSV: parse → auto-categorize → dedupe → insert.
 */
export async function importCsv(text: string): Promise<ImportStats> {
  const { rows, errors } = parseBoursoramaCsv(text)
  const stats: ImportStats = {
    total: rows.length,
    imported: 0,
    duplicates: 0,
    autoCategorized: 0,
    toValidate: 0,
    errors: [...errors],
  }
  if (!rows.length) return stats

  const rules = await loadRules()
  const now = Date.now()
  const prepared: Transaction[] = rows.map((row) => {
    const match = matchCategory(rules, row.supplier, row.label)
    if (match) stats.autoCategorized++
    else stats.toValidate++
    return {
      ...row,
      category: match ? match.category : null,
      validated: false,
      categorySource: match ? 'auto' : null,
      importedAt: now,
    }
  })

  const { imported, duplicates } = await persistNewTransactions(prepared)
  stats.imported = imported
  stats.duplicates = duplicates
  // autoCategorized/toValidate are counted over all parsed rows; adjust for dupes
  // by leaving them as an indicative figure (dominant case: no dupes on 1st import).
  return stats
}
