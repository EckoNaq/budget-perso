import { db } from './db'
import type { Category, UniversId } from './types'

/** Add a new category at the end of the given univers. */
export async function addCategory(name: string, univers: UniversId): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const exists = await db.categories.where('name').equals(trimmed).count()
  if (exists) throw new Error(`La catégorie "${trimmed}" existe déjà.`)
  const maxOrder = (await db.categories.toArray()).reduce((m, c) => Math.max(m, c.order), -1)
  await db.categories.add({ name: trimmed, univers, order: maxOrder + 1 })
}

/** Rename a category, cascading to transactions and rules that reference it. */
export async function renameCategory(id: number, newName: string): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed) return
  const cat = await db.categories.get(id)
  if (!cat || cat.name === trimmed) return
  const clash = await db.categories.where('name').equals(trimmed).count()
  if (clash) throw new Error(`La catégorie "${trimmed}" existe déjà.`)
  const old = cat.name
  await db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
    await db.categories.update(id, { name: trimmed })
    await db.transactions.where('category').equals(old).modify({ category: trimmed })
    await db.rules.where('category').equals(old).modify({ category: trimmed })
  })
}

/** Change a category's univers. */
export async function setCategoryUnivers(id: number, univers: UniversId): Promise<void> {
  await db.categories.update(id, { univers })
}

/** Delete a category; its transactions/rules are reassigned to "Inconnu". */
export async function deleteCategory(id: number): Promise<void> {
  const cat = await db.categories.get(id)
  if (!cat) return
  if (cat.name === 'Inconnu') throw new Error('La catégorie « Inconnu » ne peut pas être supprimée.')
  await db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
    await db.transactions.where('category').equals(cat.name).modify({ category: 'Inconnu' })
    await db.rules.where('category').equals(cat.name).modify({ category: 'Inconnu' })
    await db.categories.delete(id)
  })
}

/** Move a category up/down within the global order. */
export async function moveCategory(id: number, dir: -1 | 1): Promise<void> {
  const all = (await db.categories.toArray()).sort((a, b) => a.order - b.order)
  const idx = all.findIndex((c) => c.id === id)
  const swap = idx + dir
  if (idx < 0 || swap < 0 || swap >= all.length) return
  const a = all[idx] as Category
  const b = all[swap] as Category
  await db.transaction('rw', db.categories, async () => {
    await db.categories.update(a.id!, { order: b.order })
    await db.categories.update(b.id!, { order: a.order })
  })
}

/**
 * Remove re-import duplicates: within a group of transactions sharing the same
 * dedupe key, if a validated (already-categorized) one exists, delete the
 * NON-validated copies. Genuine repeats (all same validation status) are kept.
 */
export async function removeDuplicates(): Promise<{ removed: number }> {
  const all = await db.transactions.toArray()
  const byKey = new Map<string, typeof all>()
  for (const t of all) {
    const g = byKey.get(t.dedupeKey)
    if (g) g.push(t)
    else byKey.set(t.dedupeKey, [t])
  }
  const toDelete: number[] = []
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    if (group.some((t) => t.validated)) {
      for (const t of group) if (!t.validated && t.id != null) toDelete.push(t.id)
    }
  }
  if (toDelete.length) await db.transactions.bulkDelete(toDelete)
  return { removed: toDelete.length }
}

/** Rename an account label across all its transactions. */
export async function renameAccount(accountNum: string, newLabel: string): Promise<void> {
  const trimmed = newLabel.trim()
  if (!trimmed) return
  await db.transactions.where('accountNum').equals(accountNum).modify({ accountLabel: trimmed })
}
