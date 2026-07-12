// Headless smoke test of the parsing / dedupe / categorization logic against
// the real Boursorama CSV. Uses the real csv.ts parser. Categorization uses
// the real matchCategory algorithm with the shipped starter rules.
import fs from 'node:fs'
import { parseBoursoramaCsv } from '../src/lib/csv'
import { matchCategory } from '../src/lib/categorize'
import type { Rule } from '../src/db/types'

// Mirror of STARTER_RULES from seed.ts (seed.ts pulls in Dexie, avoided here).
const STARTER: { pattern: string; category: string }[] = [
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
  { pattern: 'sergic la madeleine', category: 'Loyer' },
  { pattern: 'gaz de bordeaux', category: 'Electricité / Gaz' },
  { pattern: 'totalenergies electricite et gaz', category: 'Electricité / Gaz' },
  { pattern: 'total', category: 'Essence' },
  { pattern: 'orange', category: 'Mobile' },
  { pattern: 'paypal', category: 'Divers vie quotidienne' },
  { pattern: 'boursorama banque', category: 'Divers vie quotidienne' },
  { pattern: 'dade', category: 'Coiffeur' },
  { pattern: 'jules', category: 'Vêtements' },
  { pattern: 'marc orian', category: 'Vêtements' },
  { pattern: 'kiabi', category: 'Vêtements' },
  { pattern: 'smythstoys com', category: 'Vêtements' },
  { pattern: 'mangos', category: 'Restaurants / Bars' },
  { pattern: 'sugoi sc', category: 'Restaurants / Bars' },
  { pattern: "mc donald's", category: 'Restaurants / Bars' },
  { pattern: 'fresh', category: 'Restaurants / Bars' },
  { pattern: 'brother s', category: 'Restaurants / Bars' },
  { pattern: 'la salades composee', category: 'Restaurants / Bars' },
  { pattern: 'le mannele', category: 'Restaurants / Bars' },
  { pattern: 'micromania', category: 'Jeux Vidéos' },
  { pattern: 'amazon', category: 'Jeux / objets' },
  { pattern: 'cultura', category: 'Jeux / objets' },
]
const rules: Rule[] = STARTER.map((r, i) => ({
  id: i + 1,
  matchType: 'supplier',
  pattern: r.pattern,
  category: r.category,
  count: 1,
  source: 'starter',
  updatedAt: 0,
}))

const path = process.argv[2]
const text = fs.readFileSync(path, 'utf8')
const { rows, errors } = parseBoursoramaCsv(text)

console.log('=== PARSING ===')
console.log('lignes parsées :', rows.length)
console.log('erreurs        :', errors.length, errors.slice(0, 3))

// Amount sanity checks
const big = rows.find((r) => r.label.includes('IBM INTERNATIONAL') && r.amount > 3000)
console.log('montant "3 270,49" ->', big?.amount, '(attendu 3270.49)')
const neg = rows.find((r) => r.label.startsWith('Bourse Direct'))
console.log('montant "-1 200,00" ->', neg?.amount, '(attendu -1200)')
console.log('exemple négatif Carrefour ->', rows.find((r) => r.supplier === 'carrefour')?.amount)

console.log('\n=== CATEGORISATION AUTO ===')
let auto = 0
const uncatSuppliers = new Map<string, number>()
for (const r of rows) {
  const m = matchCategory(rules, r.supplier, r.label)
  if (m) auto++
  else uncatSuppliers.set(r.supplier, (uncatSuppliers.get(r.supplier) ?? 0) + 1)
}
console.log(`auto-catégorisées : ${auto}/${rows.length} (${Math.round((auto / rows.length) * 100)}%)`)
console.log('top commerçants NON catégorisés (à apprendre) :')
;[...uncatSuppliers.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .forEach(([s, n]) => console.log(`   ${n}×  ${s}`))

console.log('\n=== DEDUP (réimport du même fichier) ===')
const existing = new Map<string, number>()
for (const r of rows) existing.set(r.dedupeKey, (existing.get(r.dedupeKey) ?? 0) + 1)
// simulate re-importing: how many would be added a second time?
const seen = new Map<string, number>()
let wouldAdd = 0
for (const r of rows) {
  const already = existing.get(r.dedupeKey) ?? 0
  const used = seen.get(r.dedupeKey) ?? 0
  seen.set(r.dedupeKey, used + 1)
  if (used >= already) wouldAdd++
}
console.log(`réimport identique -> ajoutées : ${wouldAdd} (attendu 0)`)
