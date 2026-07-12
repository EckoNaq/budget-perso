import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { aggregateYear, budgetStatus, type BudgetStatus, type UniversBlock } from '../lib/aggregate'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const CELL_BG: Record<BudgetStatus, string> = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  alert: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  neutral: 'text-slate-600 dark:text-slate-300',
}

function cell(n: number): string {
  if (Math.round(n) === 0) return ''
  return Math.round(n).toLocaleString('fr-FR')
}

/** Excel-style grid: category × 12 months, budget colours, N-1 comparison. */
export function YearDetail() {
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [year, setYear] = useState<number | null>(null)

  const agg = useMemo(() => {
    if (!transactions || !categories) return null
    const years = [...new Set(transactions.map((t) => t.year))].sort((a, b) => b - a)
    const y = year ?? years[0] ?? new Date().getFullYear()
    return aggregateYear(transactions, categories, y)
  }, [transactions, categories, year])

  if (!transactions || !categories) return <p className="text-slate-500">Chargement…</p>
  if (transactions.length === 0)
    return (
      <p className="text-slate-500 dark:text-slate-400">
        Aucune donnée. Va dans l'onglet <strong>Import</strong>.
      </p>
    )
  if (!agg) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">Année</span>
        <select
          value={agg.year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {agg.availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {agg.blocks.map((block) => (
        <UniversTable key={block.id} block={block} />
      ))}
    </div>
  )
}

function UniversTable({ block }: { block: UniversBlock }) {
  const isExpense = block.kind === 'expense'
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left dark:bg-slate-800">{block.label}</th>
            {MONTHS.map((m) => (
              <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            <th className="px-3 py-2 text-right font-medium text-slate-400">N-1</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {block.rows.map((row) => (
            <tr key={row.name}>
              <td className="sticky left-0 bg-white px-3 py-1.5 text-left text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {row.name}
              </td>
              {row.months.map((n, i) => {
                const status =
                  isExpense && Math.round(n) !== 0
                    ? budgetStatus(n, row.seuilSucces, row.seuilAlerte)
                    : 'neutral'
                return (
                  <td key={i} className={'tabular px-2 py-1.5 text-right ' + CELL_BG[status]}>
                    {cell(n)}
                  </td>
                )
              })}
              <td className="tabular px-3 py-1.5 text-right font-semibold text-slate-800 dark:text-slate-100">
                {cell(row.total)}
              </td>
              <td className="tabular px-3 py-1.5 text-right text-slate-400">{cell(row.prevTotal)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <td className="sticky left-0 bg-slate-50 px-3 py-2 text-left dark:bg-slate-800">Total {block.label}</td>
            {block.months.map((n, i) => (
              <td key={i} className="tabular px-2 py-2 text-right">{cell(n)}</td>
            ))}
            <td className="tabular px-3 py-2 text-right">{cell(block.total)}</td>
            <td className="tabular px-3 py-2 text-right text-slate-400">{cell(block.prevTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
