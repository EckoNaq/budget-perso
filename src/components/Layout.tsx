import type { ReactNode } from 'react'
import type { Theme } from '../lib/theme'

export type Tab = 'dashboard' | 'pointer' | 'transactions' | 'detail' | 'settings' | 'import'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'pointer', label: 'Pointer' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'detail', label: 'Détail annuel' },
  { id: 'settings', label: 'Paramètres' },
  { id: 'import', label: 'Import' },
]

interface Props {
  tab: Tab
  onTab: (t: Tab) => void
  theme: Theme
  onToggleTheme: () => void
  headerRight?: ReactNode
  initMsg?: string | null
  counts?: Partial<Record<Tab, number>>
  children: ReactNode
}

export function Layout({ tab, onTab, theme, onToggleTheme, headerRight, initMsg, counts, children }: Props) {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Budget Perso</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            100 % local — tes données restent dans ce navigateur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
            aria-label="Basculer le thème"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {initMsg && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {initMsg}
        </div>
      )}

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ' +
              (tab === t.id
                ? 'border-slate-800 text-slate-800 dark:border-slate-100 dark:text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200')
            }
          >
            {t.label}
            {counts?.[t.id] ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                {counts[t.id]}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {children}
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
