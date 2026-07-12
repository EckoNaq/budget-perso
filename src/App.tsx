import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { ensureSeed } from './db/seed'
import { initHistoryOnce } from './lib/initHistory'
import { useTheme } from './lib/theme'
import { Layout, type Tab } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { Pointer } from './components/Pointer'
import { YearDetail } from './components/YearDetail'
import { TransactionsTable } from './components/TransactionsTable'
import { SettingsPage } from './components/SettingsPage'
import { ImportPanel } from './components/ImportPanel'

export default function App() {
  const { theme, toggle } = useTheme()
  const [ready, setReady] = useState(false)
  const [initMsg, setInitMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')

  useEffect(() => {
    ;(async () => {
      await ensureSeed()
      try {
        setInitMsg('Chargement de ton historique…')
        const r = await initHistoryOnce()
        setInitMsg(r ? `Historique chargé : ${r.imported} opérations (dont ${r.income} revenus).` : null)
        if (r) setTimeout(() => setInitMsg(null), 6000)
      } catch {
        setInitMsg(null)
      }
      setReady(true)
    })()
  }, [])

  return <AppReady tab={tab} setTab={setTab} theme={theme} toggle={toggle} initMsg={initMsg} ready={ready} />
}

function AppReady({
  tab,
  setTab,
  theme,
  toggle,
  initMsg,
  ready,
}: {
  tab: Tab
  setTab: (t: Tab) => void
  theme: 'light' | 'dark'
  toggle: () => void
  initMsg: string | null
  ready: boolean
}) {
  const toValidateCount = useLiveQuery(
    () => db.transactions.filter((t) => !t.validated && !t.ignored).count(),
    [],
  )

  if (!ready)
    return <div className="p-8 text-slate-500 dark:text-slate-400">{initMsg ?? 'Initialisation…'}</div>

  return (
    <Layout
      tab={tab}
      onTab={setTab}
      theme={theme}
      onToggleTheme={toggle}
      initMsg={initMsg}
      counts={{ pointer: toValidateCount ?? 0 }}
    >
      {tab === 'dashboard' && <Dashboard theme={theme} />}
      {tab === 'pointer' && <Pointer theme={theme} />}
      {tab === 'transactions' && <TransactionsTable />}
      {tab === 'detail' && <YearDetail />}
      {tab === 'settings' && <SettingsPage />}
      {tab === 'import' && <ImportPanel />}
    </Layout>
  )
}
