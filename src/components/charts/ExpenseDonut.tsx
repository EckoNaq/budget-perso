import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { UniversId } from '../../db/types'
import type { Theme } from '../../lib/theme'
import { chartInk, universColor } from '../../lib/palette'
import { formatEur } from '../../lib/text'
import { CurrencyTooltip } from './chartUtils'

interface Slice {
  id: UniversId
  label: string
  value: number
}

export function ExpenseDonut({ data, theme }: { data: Slice[]; theme: Theme }) {
  const ink = chartInk(theme)
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!total) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Aucune dépense</div>
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative h-56 w-full sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke={ink.surface}
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={universColor(d.id, theme)} />
              ))}
            </Pie>
            <Tooltip content={(p) => <CurrencyTooltip {...(p as object)} theme={theme} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
          <div className="tabular text-lg font-semibold text-slate-800 dark:text-slate-100">
            {formatEur(total)}
          </div>
        </div>
      </div>

      {/* Legend + direct values (identity never color-alone) */}
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.id} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: universColor(d.id, theme) }}
            />
            <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
            <span className="ml-auto tabular font-medium text-slate-800 dark:text-slate-100">
              {formatEur(d.value)}
            </span>
            <span className="w-10 text-right tabular text-xs text-slate-400">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
