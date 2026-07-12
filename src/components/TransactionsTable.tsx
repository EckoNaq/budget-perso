import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Transaction } from '../db/types'
import { learnSupplierRule } from '../lib/categorize'
import { formatEur } from '../lib/text'
import { CategorySelect } from './CategorySelect'

const MONTHS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
]

export function TransactionsTable() {
  const all = useLiveQuery(
    () =>
      db.transactions
        .toArray()
        .then((rows) => rows.sort((a, b) => (a.dateOp < b.dateOp ? 1 : a.dateOp > b.dateOp ? -1 : 0))),
    [],
  )
  const [year, setYear] = useState<number | 'all'>('all')
  const [month, setMonth] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [onlyToValidate, setOnlyToValidate] = useState(false)

  const years = useMemo(() => {
    const set = new Set<number>()
    all?.forEach((t) => set.add(t.year))
    return [...set].sort((a, b) => b - a)
  }, [all])

  const filtered = useMemo(() => {
    if (!all) return []
    const q = search.trim().toLowerCase()
    return all.filter((t) => {
      if (year !== 'all' && t.year !== year) return false
      if (month !== 'all' && t.month !== month) return false
      if (onlyToValidate && (t.validated || t.ignored)) return false
      if (q && !(t.label.toLowerCase().includes(q) || t.supplier.toLowerCase().includes(q)))
        return false
      return true
    })
  }, [all, year, month, search, onlyToValidate])

  const toValidateCount = useMemo(
    () => all?.filter((t) => !t.validated && !t.ignored).length ?? 0,
    [all],
  )

  async function toggleIgnore(t: Transaction) {
    await db.transactions.update(t.id!, { ignored: !t.ignored })
  }

  async function setCategory(t: Transaction, category: string) {
    await db.transactions.update(t.id!, {
      category,
      validated: true,
      categorySource: t.categorySource === 'auto' && t.category === category ? 'auto' : 'manual',
    })
    await learnSupplierRule(t.supplier, category)
  }

  async function confirm(t: Transaction) {
    if (!t.category) return
    await db.transactions.update(t.id!, { validated: true })
    await learnSupplierRule(t.supplier, t.category)
  }

  if (!all) return <p className="text-slate-500">Chargement…</p>
  if (all.length === 0)
    return (
      <p className="text-slate-500">
        Aucune opération. Va dans l'onglet <strong>Import</strong> pour charger ton CSV.
      </p>
    )

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">Toutes années</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">Tous mois</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher libellé / commerçant…"
          className="grow rounded border border-slate-300 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={onlyToValidate}
            onChange={(e) => setOnlyToValidate(e.target.checked)}
          />
          À valider seulement
          {toValidateCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-700">
              {toValidateCount}
            </span>
          )}
        </label>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} opération(s)</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Libellé</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.slice(0, 500).map((t) => (
              <tr
                key={t.id}
                className={
                  t.ignored
                    ? 'opacity-45'
                    : t.validated
                      ? ''
                      : 'bg-amber-50/40 dark:bg-amber-950/20'
                }
              >
                <td className="whitespace-nowrap px-3 py-2 tabular text-slate-500 dark:text-slate-400">{t.dateOp}</td>
                <td className="px-3 py-2">
                  <div
                    className={
                      'max-w-md truncate text-slate-700 dark:text-slate-200 ' +
                      (t.ignored ? 'line-through' : '')
                    }
                    title={t.label}
                  >
                    {t.supplier || t.label}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t.accountLabel}
                    {t.ignored && ' · ignorée'}
                  </div>
                </td>
                <td
                  className={
                    'whitespace-nowrap px-3 py-2 text-right tabular font-medium ' +
                    (t.ignored ? 'line-through ' : '') +
                    (t.amount < 0 ? 'text-slate-700 dark:text-slate-200' : 'text-emerald-600 dark:text-emerald-400')
                  }
                >
                  {formatEur(t.amount)}
                </td>
                <td className="px-3 py-2">
                  <CategorySelect
                    value={t.category}
                    autoFilled={!t.validated && t.categorySource === 'auto'}
                    onChange={(cat) => void setCategory(t, cat)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {!t.ignored && !t.validated && t.category && (
                      <button
                        onClick={() => void confirm(t)}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        title="Valider la catégorie proposée"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => void toggleIgnore(t)}
                      className={
                        'rounded px-2 py-1 text-xs font-medium ' +
                        (t.ignored
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                          : 'border border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800')
                      }
                      title={t.ignored ? 'Réintégrer dans les calculs' : 'Ignorer (exclure des calculs)'}
                    >
                      {t.ignored ? 'Réactiver' : 'Ignorer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <p className="p-3 text-center text-xs text-slate-400">
            Affichage limité aux 500 premières lignes — affine les filtres.
          </p>
        )}
      </div>
    </div>
  )
}
