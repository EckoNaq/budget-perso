import { db } from './db'
import type { Category, Rule, Univers } from './types'
import { normalize } from '../lib/text'
import { buildDedupeKey } from '../lib/csv'

const DEDUPE_MIGRATION_FLAG = 'dedupeMigrated_v2'

// Univers (top-level groups), mirroring the Excel year sheets.
export const UNIVERS: Univers[] = [
  { id: 'revenus', label: 'Revenus', kind: 'income', order: 0 },
  { id: 'logement', label: 'Logement', kind: 'expense', order: 1 },
  { id: 'vehicule', label: 'Véhicule', kind: 'expense', order: 2 },
  { id: 'quotidien', label: 'Vie quotidienne', kind: 'expense', order: 3 },
  { id: 'loisirs', label: 'Loisirs', kind: 'expense', order: 4 },
  { id: 'autre', label: 'Autre', kind: 'expense', order: 5 },
]

export const UNIVERS_BY_ID = Object.fromEntries(UNIVERS.map((u) => [u.id, u]))

/** All valid category names (the only ones accepted from an Excel import). */
export const CATEGORY_NAMES = () => CATEGORY_SEED.map((c) => c.name)

// The 24 user categories + Inconnu, with success/alert thresholds from the
// Excel (blank thresholds = not budget-tracked).
const CATEGORY_SEED: Omit<Category, 'id' | 'order'>[] = [
  // Revenus
  { name: 'Salaire', univers: 'revenus' },
  { name: 'Bonus', univers: 'revenus' },
  { name: 'Divers revenus', univers: 'revenus' },
  // Logement (no thresholds)
  { name: 'Loyer', univers: 'logement' },
  { name: 'Assurance maison', univers: 'logement' },
  { name: 'Electricité / Gaz', univers: 'logement' },
  { name: 'Eau', univers: 'logement' },
  { name: 'Divers logement', univers: 'logement' },
  // Véhicule
  { name: 'Assurance auto', univers: 'vehicule', seuilSucces: 1, seuilAlerte: 70 },
  { name: 'Essence', univers: 'vehicule', seuilSucces: 50, seuilAlerte: 80 },
  { name: 'Entretien', univers: 'vehicule', seuilSucces: 1, seuilAlerte: 80 },
  { name: 'Divers véhicule', univers: 'vehicule', seuilSucces: 1, seuilAlerte: 50 },
  // Vie quotidienne
  { name: 'Courses', univers: 'quotidien', seuilSucces: 150, seuilAlerte: 300 },
  { name: 'Internet', univers: 'quotidien', seuilSucces: 10, seuilAlerte: 70 },
  { name: 'Mobile', univers: 'quotidien', seuilSucces: 14, seuilAlerte: 20 },
  { name: 'Abonnements', univers: 'quotidien', seuilSucces: 30, seuilAlerte: 50 },
  { name: 'Vêtements', univers: 'quotidien', seuilSucces: 50, seuilAlerte: 125 },
  { name: 'Coiffeur', univers: 'quotidien', seuilSucces: 25, seuilAlerte: 50 },
  { name: 'Deliveroo', univers: 'quotidien', seuilSucces: 30, seuilAlerte: 75 },
  { name: 'Divers vie quotidienne', univers: 'quotidien', seuilSucces: 25, seuilAlerte: 75 },
  { name: 'Assurance santé', univers: 'quotidien', seuilSucces: 25, seuilAlerte: 75 },
  // Loisirs
  { name: 'Restaurants / Bars', univers: 'loisirs', seuilSucces: 75, seuilAlerte: 150 },
  { name: 'Jeux Vidéos', univers: 'loisirs', seuilSucces: 1, seuilAlerte: 100 },
  { name: 'Jeux / objets', univers: 'loisirs', seuilSucces: 30, seuilAlerte: 75 },
  { name: 'Sorties', univers: 'loisirs', seuilSucces: 25, seuilAlerte: 75 },
  { name: 'Divers loisirs', univers: 'loisirs', seuilSucces: 10, seuilAlerte: 35 },
  // Fourre-tout
  { name: 'Inconnu', univers: 'autre' },
]

// Starter merchant→category rules, inferred from the existing categorisation.
// These give a mostly pre-filled first import; the rest is learned on the fly.
const STARTER_RULES: { pattern: string; category: string }[] = [
  // Courses
  { pattern: 'carrefour', category: 'Courses' },
  { pattern: 'carrefour city', category: 'Courses' },
  { pattern: 'carrefour market', category: 'Courses' },
  { pattern: 'intermarche', category: 'Courses' },
  { pattern: 'flalom', category: 'Courses' },
  { pattern: 'lidl', category: 'Courses' },
  { pattern: 'match', category: 'Courses' },
  { pattern: 'proxi', category: 'Courses' },
  { pattern: 'epiceries terre', category: 'Courses' },
  { pattern: 'marie blachere', category: 'Courses' },
  { pattern: 'ilevia dat metro', category: 'Courses' },
  // Loyer / Logement / Énergie
  { pattern: 'sergic la madeleine', category: 'Loyer' },
  { pattern: 'gaz de bordeaux', category: 'Electricité / Gaz' },
  { pattern: 'totalenergies electricite et gaz', category: 'Electricité / Gaz' },
  // Véhicule
  { pattern: 'total', category: 'Essence' },
  // Vie quotidienne
  { pattern: 'orange', category: 'Mobile' },
  { pattern: 'boursorama banque', category: 'Divers vie quotidienne' },
  { pattern: 'dade', category: 'Coiffeur' },
  // Vêtements
  { pattern: 'jules', category: 'Vêtements' },
  { pattern: 'marc orian', category: 'Vêtements' },
  { pattern: 'kiabi', category: 'Vêtements' },
  { pattern: 'smythstoys com', category: 'Vêtements' },
  // Loisirs — restaurants
  { pattern: 'mangos', category: 'Restaurants / Bars' },
  { pattern: 'sugoi sc', category: 'Restaurants / Bars' },
  { pattern: "mc donald's", category: 'Restaurants / Bars' },
  { pattern: 'fresh', category: 'Restaurants / Bars' },
  { pattern: 'brother s', category: 'Restaurants / Bars' },
  { pattern: 'la salades composee', category: 'Restaurants / Bars' },
  { pattern: 'le mannele', category: 'Restaurants / Bars' },
  // Loisirs — jeux / objets
  { pattern: 'micromania', category: 'Jeux Vidéos' },
  { pattern: 'cultura', category: 'Jeux / objets' },
]

// Passthrough merchants: same name, different real categories each time.
// Never auto-categorized — always left to validate.
export const AMBIGUOUS_SUPPLIERS = [
  'amazon',
  'amazon prime',
  'amazon payments',
  'paypal',
  'google',
  'google play apps',
  'sumup',
  'lydia',
]

/**
 * Seed the database on first run. Idempotent and safe against concurrent
 * calls (React StrictMode invokes effects twice in dev): the work is memoized
 * so it runs at most once per page load, and each table is checked/filled
 * inside a single read-write transaction so a racing call can't double-insert.
 */
let seedPromise: Promise<void> | null = null

export function ensureSeed(): Promise<void> {
  if (!seedPromise)
    seedPromise = doSeed()
      .then(reconcileAmbiguousTransactions)
      .then(() => {
        if (!safeGetFlag(DEDUPE_MIGRATION_FLAG)) return migrateDedupeKeys().then(() => safeSetFlag(DEDUPE_MIGRATION_FLAG))
      })
  return seedPromise
}

function safeGetFlag(k: string): boolean {
  try {
    return !!localStorage.getItem(k)
  } catch {
    return false
  }
}
function safeSetFlag(k: string) {
  try {
    localStorage.setItem(k, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Recompute dedupe keys of existing transactions to the current stable scheme
 * (no balance, label-core). Skips synthetic keys (yearly income, manual entries)
 * so their idempotency is preserved. Runs once, and after a backup restore.
 */
export async function migrateDedupeKeys(): Promise<void> {
  const all = await db.transactions.toArray()
  const updates = all.filter((t) => {
    const k = t.dedupeKey || ''
    if (k.startsWith('manual-income|') || /\|m\d{10,}$/.test(k)) return false
    return buildDedupeKey(t) !== t.dedupeKey
  })
  if (updates.length) {
    await db.transactions.bulkPut(updates.map((t) => ({ ...t, dedupeKey: buildDedupeKey(t) })))
  }
}

/**
 * Wipe all transactions and learned rules, then re-seed the starter rules.
 * Categories (and their thresholds) are kept. Does NOT touch the history flag
 * and does NOT re-import the bundled Excel — the app simply becomes empty, so
 * this is safe to use at any time (it won't revert to an old snapshot).
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.transactions, db.rules, async () => {
    await db.transactions.clear()
    await db.rules.clear()
  })
  seedPromise = null
  await ensureSeed()
}

/**
 * Reset transactions that were AUTO-categorized (never confirmed by the user)
 * whose merchant is now flagged ambiguous — they go back to "à valider".
 * Manually validated transactions are left untouched.
 */
async function reconcileAmbiguousTransactions(): Promise<void> {
  const ambiguousPatterns = (await db.rules.toArray())
    .filter((r) => r.ambiguous)
    .map((r) => r.pattern)
  if (!ambiguousPatterns.length) return

  const isAmbiguous = (sup: string) =>
    ambiguousPatterns.some((p) => sup === p || sup.startsWith(p + ' '))

  const stale = await db.transactions
    .filter(
      (t) =>
        !t.validated &&
        t.categorySource === 'auto' &&
        t.category != null &&
        !!t.supplier &&
        isAmbiguous(normalize(t.supplier)),
    )
    .toArray()
  if (!stale.length) return

  await db.transactions.bulkPut(
    stale.map((t) => ({ ...t, category: null, categorySource: null })),
  )
}

async function doSeed(): Promise<void> {
  await db.transaction('rw', db.categories, db.rules, async () => {
    // Add only categories/rules whose natural key is missing — self-healing
    // even if a previous run seeded partially.
    const existingCatNames = new Set((await db.categories.toArray()).map((c) => c.name))
    const missingCats = CATEGORY_SEED.map((c, i) => ({ ...c, order: i })).filter(
      (c) => !existingCatNames.has(c.name),
    )
    if (missingCats.length) await db.categories.bulkAdd(missingCats as Category[])

    const existingRules = await db.rules.toArray()
    const existingPatterns = new Set(existingRules.map((r) => r.pattern))
    const now = Date.now()
    const missingRules = STARTER_RULES.filter((r) => !existingPatterns.has(r.pattern)).map((r) => ({
      matchType: 'supplier' as const,
      pattern: r.pattern,
      category: r.category,
      count: 1,
      source: 'starter' as const,
      updatedAt: now,
    }))
    if (missingRules.length) await db.rules.bulkAdd(missingRules as Rule[])

    // Reconcile ambiguous (passthrough) merchants: ensure each is flagged,
    // adding or updating so it's fixed even on an already-seeded database.
    const byPattern = new Map(existingRules.map((r) => [r.pattern, r]))
    for (const pattern of AMBIGUOUS_SUPPLIERS) {
      const existing = byPattern.get(pattern)
      if (existing) {
        if (!existing.ambiguous) await db.rules.update(existing.id!, { ambiguous: true })
      } else {
        await db.rules.add({
          matchType: 'supplier',
          pattern,
          category: '',
          ambiguous: true,
          count: 0,
          source: 'starter',
          updatedAt: now,
        } as Rule)
      }
    }
  })
}
