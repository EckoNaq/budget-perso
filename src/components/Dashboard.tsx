import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  aggregateYear,
  cumulativeSavings,
  expensesByUnivers,
  monthlyIncomeExpense,
} from '../lib/aggregate'
import { formatEur } from '../lib/text'
import type { Theme } from '../lib/theme'
import { ExpenseDonut } from './charts/ExpenseDonut'
import { IncomeExpenseBars } from './charts/IncomeExpenseBars'
import { SavingsTrend } from './charts/SavingsTrend'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const card =
  'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const selectCls =
  'rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'

export function Dashboard({ theme }: { theme: Theme }) {
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | 'all'>('all')

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

  const donutData = expensesByUnivers(agg, month === 'all' ? undefined : month)
  const bars = monthlyIncomeExpense(agg)
  const trend = cumulativeSavings(agg)

  // KPIs follow the period filter: full year, or the selected month.
  const kpi =
    month === 'all'
      ? { revenus: agg.revenus, depenses: agg.depenses, balance: agg.balance, taux: agg.tauxEpargne }
      : (() => {
          const row = bars[month - 1]
          const taux = row.revenus > 0 ? (row.balance / row.revenus) * 100 : 0
          return { revenus: row.revenus, depenses: row.depenses, balance: row.balance, taux }
        })()

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={agg.year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
          {agg.availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className={selectCls}
        >
          <option value="all">Année entière</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      {/* KPI cards — follow the period filter (year or selected month) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Revenus" value={kpi.revenus} tone="income" />
        <Kpi label="Dépenses" value={kpi.depenses} />
        <Kpi label="Balance" value={kpi.balance} tone={kpi.balance >= 0 ? 'income' : 'bad'} />
        <div className={card}>
          <div className="text-xs text-slate-500 dark:text-slate-400">Taux d'épargne</div>
          <div
            className={
              'tabular mt-1 text-2xl font-semibold ' +
              (kpi.taux >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
            }
          >
            {kpi.taux.toFixed(1)} %
          </div>
        </div>
      </div>

      {agg.uncategorized.count > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {agg.uncategorized.count} opération(s) non catégorisée(s) cette année ({formatEur(agg.uncategorized.total)})
          — non comptées. Catégorise-les dans l'onglet <strong>Transactions</strong>.
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h3 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
            Dépenses par univers {month === 'all' ? `— ${agg.year}` : `— ${MONTHS[Number(month) - 1]} ${agg.year}`}
          </h3>
          <ExpenseDonut data={donutData} theme={theme} />
        </section>

        <section className={card}>
          <h3 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
            Revenus vs dépenses par mois
          </h3>
          <IncomeExpenseBars data={bars} theme={theme} />
          <Legend theme={theme} />
        </section>

        <section className={card + ' lg:col-span-2'}>
          <h3 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Épargne cumulée</h3>
          <SavingsTrend data={trend} theme={theme} />
        </section>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'income' | 'bad' }) {
  const color =
    tone === 'income'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-800 dark:text-slate-100'
  return (
    <div className={card}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={'tabular mt-1 text-2xl font-semibold ' + color}>{formatEur(value)}</div>
    </div>
  )
}

function Legend({ theme }: { theme: Theme }) {
  const items = [
    { label: 'Revenus', color: theme === 'dark' ? '#199e70' : '#1baf7a' },
    { label: 'Dépenses', color: theme === 'dark' ? '#d95926' : '#eb6834' },
    { label: 'Balance', color: theme === 'dark' ? '#ffffff' : '#0b0b0b' },
  ]
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
