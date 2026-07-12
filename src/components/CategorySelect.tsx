import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { UNIVERS } from '../db/seed'
import type { Category } from '../db/types'

interface Props {
  value: string | null
  onChange: (category: string) => void
  autoFilled?: boolean // styled differently when set automatically but unvalidated
  className?: string
}

export function CategorySelect({ value, onChange, autoFilled, className }: Props) {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  if (!categories) return null

  const byUnivers = new Map<string, Category[]>()
  for (const c of categories) {
    if (!byUnivers.has(c.univers)) byUnivers.set(c.univers, [])
    byUnivers.get(c.univers)!.push(c)
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={
        'rounded border px-2 py-1 text-sm ' +
        (value == null
          ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300'
          : autoFilled
            ? 'border-sky-300 bg-sky-50 text-slate-700 dark:border-sky-700 dark:bg-sky-950 dark:text-slate-200'
            : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200') +
        (className ? ' ' + className : '')
      }
    >
      <option value="" disabled>
        — à catégoriser —
      </option>
      {UNIVERS.map((u) => {
        const cats = byUnivers.get(u.id)
        if (!cats?.length) return null
        return (
          <optgroup key={u.id} label={u.label}>
            {cats.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
