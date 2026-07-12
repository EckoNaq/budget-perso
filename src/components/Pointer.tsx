import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Category, Transaction } from '../db/types'
import { UNIVERS } from '../db/seed'
import { learnSupplierRule } from '../lib/categorize'
import { universColor } from '../lib/palette'
import { formatEur } from '../lib/text'
import type { Theme } from '../lib/theme'

export function Pointer({ theme }: { theme: Theme }) {
  const toValidate = useLiveQuery(
    () => db.transactions.filter((t) => !t.validated && !t.ignored).toArray(),
    [],
  )
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [sessionTotal, setSessionTotal] = useState<number | null>(null)

  // Queue sorted by date desc, skipped items pushed to the end of this session.
  const queue = useMemo(() => {
    if (!toValidate) return []
    return [...toValidate].sort((a, b) => {
      const sa = skipped.has(a.id!) ? 1 : 0
      const sb = skipped.has(b.id!) ? 1 : 0
      if (sa !== sb) return sa - sb
      return a.dateOp < b.dateOp ? 1 : a.dateOp > b.dateOp ? -1 : 0
    })
  }, [toValidate, skipped])

  if (!toValidate || !categories) return <p className="text-slate-500">Chargement…</p>

  const remaining = toValidate.length
  if (sessionTotal === null && remaining > 0) setSessionTotal(remaining)

  if (remaining === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="text-4xl">🎉</div>
        <h2 className="mt-3 text-xl font-semibold text-slate-800 dark:text-slate-100">Tout est pointé !</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Aucune opération en attente de catégorisation.
        </p>
      </div>
    )
  }

  const current = queue[0]
  const done = (sessionTotal ?? remaining) - remaining
  const pct = sessionTotal ? Math.round((done / sessionTotal) * 100) : 0

  async function choose(cat: string) {
    const t = current
    await db.transactions.update(t.id!, {
      category: cat,
      validated: true,
      categorySource: t.categorySource === 'auto' && t.category === cat ? 'auto' : 'manual',
    })
    await learnSupplierRule(t.supplier, cat)
  }
  async function ignore() {
    await db.transactions.update(current.id!, { ignored: true })
  }
  function skip() {
    setSkipped((s) => new Set(s).add(current.id!))
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{remaining} à pointer</span>
          {sessionTotal ? <span>{done} / {sessionTotal}</span> : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <TxCard tx={current} categories={categories} theme={theme} onChoose={choose} onSkip={skip} onIgnore={ignore} />
    </div>
  )
}

function TxCard({
  tx,
  categories,
  theme,
  onChoose,
  onSkip,
  onIgnore,
}: {
  tx: Transaction
  categories: Category[]
  theme: Theme
  onChoose: (cat: string) => void
  onSkip: () => void
  onIgnore: () => void
}) {
  const suggested = tx.category // auto-suggestion (may be null)
  const byUnivers = UNIVERS.map((u) => ({
    u,
    cats: categories.filter((c) => c.univers === u.id),
  })).filter((g) => g.cats.length)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Operation */}
      <div className="text-center">
        <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {tx.supplier || tx.label}
        </div>
        <div
          className={
            'tabular mt-1 text-3xl font-bold ' +
            (tx.amount < 0 ? 'text-slate-800 dark:text-slate-100' : 'text-emerald-600 dark:text-emerald-400')
          }
        >
          {formatEur(tx.amount)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {tx.dateOp} · {tx.accountLabel}
        </div>
        <div className="mt-1 max-w-full truncate text-xs text-slate-400" title={tx.label}>
          {tx.label}
        </div>
        {suggested && (
          <div className="mt-2 text-xs text-sky-600 dark:text-sky-400">
            Suggestion : <strong>{suggested}</strong> ✦
          </div>
        )}
      </div>

      {/* Category chips grouped by univers */}
      <div className="mt-5 space-y-3">
        {byUnivers.map(({ u, cats }) => (
          <div key={u.id}>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{u.label}</div>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const color = universColor(u.id, theme)
                const isSuggested = c.name === suggested
                return (
                  <button
                    key={c.name}
                    onClick={() => onChoose(c.name)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium transition"
                    style={
                      isSuggested
                        ? { background: color, borderColor: color, color: '#fff' }
                        : { borderColor: color, background: color + '1f', color: theme === 'dark' ? '#e2e8f0' : '#334155' }
                    }
                    title={isSuggested ? 'Catégorie suggérée' : undefined}
                  >
                    {isSuggested ? '✦ ' : ''}
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          onClick={onSkip}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ← Passer
        </button>
        <button
          onClick={onIgnore}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Ignorer
        </button>
      </div>
    </div>
  )
}
