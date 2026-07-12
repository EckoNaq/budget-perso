import { db } from './db'
import type { Category, Rule, Transaction } from './types'
import { HISTORY_FLAG } from '../lib/initHistory'
import { migrateDedupeKeys } from './seed'

interface BackupFile {
  app: 'budget-perso'
  version: number
  exportedAt: string
  categories: Category[]
  rules: Rule[]
  transactions: Transaction[]
}

/** Download a full JSON backup of everything stored locally. */
export async function exportBackup(): Promise<void> {
  const [categories, rules, transactions] = await Promise.all([
    db.categories.toArray(),
    db.rules.toArray(),
    db.transactions.toArray(),
  ])
  const payload: BackupFile = {
    app: 'budget-perso',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    rules,
    transactions,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `budget-perso-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Restore from a JSON backup, replacing all current data. Marks the history
 * as already-initialized so the bundled Excel is not re-imported on top.
 */
export async function restoreBackup(text: string): Promise<{ transactions: number }> {
  let data: BackupFile
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Fichier illisible (JSON invalide).')
  }
  if (!data || data.app !== 'budget-perso' || !Array.isArray(data.transactions)) {
    throw new Error("Ce fichier n'est pas une sauvegarde Budget Perso.")
  }

  await db.transaction('rw', db.categories, db.rules, db.transactions, async () => {
    await db.transactions.clear()
    await db.rules.clear()
    await db.categories.clear()
    if (data.categories?.length) await db.categories.bulkPut(data.categories)
    if (data.rules?.length) await db.rules.bulkPut(data.rules)
    if (data.transactions?.length) await db.transactions.bulkPut(data.transactions)
  })

  try {
    localStorage.setItem(HISTORY_FLAG, 'restored')
  } catch {
    /* ignore */
  }
  // Restored backups may carry old-scheme keys → bring them up to date so
  // future imports dedupe correctly.
  await migrateDedupeKeys()
  return { transactions: data.transactions.length }
}
