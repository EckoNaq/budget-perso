import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Theme } from '../../lib/theme'
import { chartInk, incomeColor } from '../../lib/palette'
import { CurrencyTooltip } from './chartUtils'

interface Row {
  mois: string
  cumul: number
}

export function SavingsTrend({ data, theme }: { data: Row[]; theme: Theme }) {
  const ink = chartInk(theme)
  const color = incomeColor(theme)
  const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={ink.grid} vertical={false} />
          <XAxis dataKey="mois" tick={{ fill: ink.muted, fontSize: 12 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
          <YAxis
            tick={{ fill: ink.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmt}
            width={38}
          />
          <Tooltip content={(p) => <CurrencyTooltip {...(p as object)} theme={theme} />} />
          <Area
            type="monotone"
            dataKey="cumul"
            name="Épargne cumulée"
            stroke={color}
            strokeWidth={2}
            fill="url(#savingsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
