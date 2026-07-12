import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Theme } from '../../lib/theme'
import { chartInk, expenseColor, incomeColor } from '../../lib/palette'
import { CurrencyTooltip } from './chartUtils'

interface Row {
  mois: string
  revenus: number
  depenses: number
  balance: number
}

export function IncomeExpenseBars({ data, theme }: { data: Row[]; theme: Theme }) {
  const ink = chartInk(theme)
  const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={ink.grid} vertical={false} />
          <XAxis dataKey="mois" tick={{ fill: ink.muted, fontSize: 12 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
          <YAxis
            tick={{ fill: ink.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmt}
            width={38}
          />
          <Tooltip
            cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
            content={(p) => <CurrencyTooltip {...(p as object)} theme={theme} />}
          />
          <Bar dataKey="revenus" name="Revenus" fill={incomeColor(theme)} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="depenses" name="Dépenses" fill={expenseColor(theme)} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke={ink.text}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
