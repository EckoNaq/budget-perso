import type { Category, Transaction, UniversId } from '../db/types'
import { UNIVERS, UNIVERS_BY_ID } from '../db/seed'

export interface CategoryRow {
  name: string
  univers: UniversId
  kind: 'income' | 'expense'
  months: number[] // 12 entries; expense = amount spent (positive), income = received
  total: number
  prevTotal: number // same category, previous year
  seuilSucces?: number | null
  seuilAlerte?: number | null
}

export interface UniversBlock {
  id: UniversId
  label: string
  kind: 'income' | 'expense'
  rows: CategoryRow[]
  months: number[] // 12 totals
  total: number
  prevTotal: number
}

export interface YearAggregate {
  year: number
  availableYears: number[]
  blocks: UniversBlock[]
  uncategorized: { months: number[]; total: number; count: number }
  revenus: number
  depenses: number
  balance: number
  tauxEpargne: number // percentage
}

export type BudgetStatus = 'success' | 'warn' | 'alert' | 'neutral'

/** Colour status of a monthly spend against a category's thresholds. */
export function budgetStatus(
  spent: number,
  succes?: number | null,
  alerte?: number | null,
): BudgetStatus {
  if (succes == null && alerte == null) return 'neutral'
  if (alerte != null && spent >= alerte) return 'alert'
  if (succes != null && spent <= succes) return 'success'
  return 'warn'
}

const zeros = () => Array(12).fill(0)

const MONTH_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
]

/** Monthly income vs expense (+ balance) for the chart. */
export function monthlyIncomeExpense(agg: YearAggregate) {
  const rev = zeros()
  const dep = zeros()
  for (const b of agg.blocks) {
    const target = b.kind === 'income' ? rev : dep
    b.months.forEach((n, i) => (target[i] += n))
  }
  return MONTH_LABELS.map((mois, i) => ({
    mois,
    revenus: rev[i],
    depenses: dep[i],
    balance: rev[i] - dep[i],
  }))
}

/** Expense split by univers — for the whole year, or one month (1-12). */
export function expensesByUnivers(agg: YearAggregate, month?: number) {
  return agg.blocks
    .filter((b) => b.kind === 'expense')
    .map((b) => ({
      id: b.id,
      label: b.label,
      value: month ? b.months[month - 1] : b.total,
    }))
    .filter((d) => d.value > 0.005)
    .sort((a, b) => b.value - a.value)
}

/** Cumulative savings (running income − expense) across the year. */
export function cumulativeSavings(agg: YearAggregate) {
  const m = monthlyIncomeExpense(agg)
  let running = 0
  return m.map((row) => {
    running += row.balance
    return { mois: row.mois, cumul: running }
  })
}

/**
 * Build the per-year budget-vs-actual grid, N-1 comparison and top-line
 * synthesis from all transactions.
 */
export function aggregateYear(
  transactions: Transaction[],
  categories: Category[],
  year: number,
): YearAggregate {
  const availableYears = [...new Set(transactions.map((t) => t.year))].sort((a, b) => b - a)
  const catByName = new Map(categories.map((c) => [c.name, c]))

  // value(cat, tx): expense categories accumulate spending as positive
  // (a refund reduces it); income categories accumulate received amounts.
  const kindOf = (univers: UniversId) => UNIVERS_BY_ID[univers]?.kind ?? 'expense'
  const valueOf = (univers: UniversId, amount: number) =>
    kindOf(univers) === 'income' ? amount : -amount

  // Accumulate current + previous year per category.
  const cur = new Map<string, number[]>()
  const prev = new Map<string, number>()
  const uncategorized = { months: zeros(), total: 0, count: 0 }

  for (const t of transactions) {
    if (t.ignored) continue // excluded from all aggregations
    const cat = t.category ? catByName.get(t.category) : undefined
    if (!cat) {
      if (t.year === year) {
        uncategorized.months[t.month - 1] += t.amount
        uncategorized.total += t.amount
        uncategorized.count++
      }
      continue
    }
    const v = valueOf(cat.univers, t.amount)
    if (t.year === year) {
      if (!cur.has(cat.name)) cur.set(cat.name, zeros())
      cur.get(cat.name)![t.month - 1] += v
    } else if (t.year === year - 1) {
      prev.set(cat.name, (prev.get(cat.name) ?? 0) + v)
    }
  }

  const blocks: UniversBlock[] = []
  for (const u of UNIVERS) {
    const cats = categories
      .filter((c) => c.univers === u.id)
      .sort((a, b) => a.order - b.order)
    if (!cats.length) continue

    const rows: CategoryRow[] = cats.map((c) => {
      const months = cur.get(c.name) ?? zeros()
      const total = months.reduce((s, n) => s + n, 0)
      return {
        name: c.name,
        univers: u.id,
        kind: u.kind,
        months,
        total,
        prevTotal: prev.get(c.name) ?? 0,
        seuilSucces: c.seuilSucces,
        seuilAlerte: c.seuilAlerte,
      }
    })

    const months = zeros()
    rows.forEach((r) => r.months.forEach((n, i) => (months[i] += n)))
    const total = months.reduce((s, n) => s + n, 0)
    const prevTotal = rows.reduce((s, r) => s + r.prevTotal, 0)
    blocks.push({ id: u.id, label: u.label, kind: u.kind, rows, months, total, prevTotal })
  }

  const revenus = blocks.filter((b) => b.kind === 'income').reduce((s, b) => s + b.total, 0)
  const depenses = blocks.filter((b) => b.kind === 'expense').reduce((s, b) => s + b.total, 0)
  const balance = revenus - depenses
  const tauxEpargne = revenus > 0 ? (balance / revenus) * 100 : 0

  return {
    year,
    availableYears,
    blocks,
    uncategorized,
    revenus,
    depenses,
    balance,
    tauxEpargne,
  }
}
