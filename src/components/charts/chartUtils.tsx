import type { Theme } from '../../lib/theme'
import { chartInk } from '../../lib/palette'
import { formatEur } from '../../lib/text'

/** Themed tooltip for currency values. */
export function CurrencyTooltip({
  active,
  payload,
  label,
  theme,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]
  label?: string
  theme: Theme
}) {
  if (!active || !payload?.length) return null
  const ink = chartInk(theme)
  return (
    <div
      style={{
        background: ink.tooltipBg,
        border: `1px solid ${ink.tooltipBorder}`,
        borderRadius: 8,
        padding: '8px 10px',
        color: ink.text,
        fontSize: 13,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
    >
      {label != null && <div style={{ color: ink.textSecondary, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ width: 9, height: 9, borderRadius: 2, background: p.color, display: 'inline-block' }}
          />
          <span style={{ color: ink.textSecondary }}>{p.name} :</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEur(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}
