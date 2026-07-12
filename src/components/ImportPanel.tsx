import { useRef, useState } from 'react'
import { importCsv, type ImportStats } from '../lib/import'
import { importExcelData, type ExcelImportStats } from '../lib/xlsxImport'
import { clearAllData } from '../db/seed'
import { exportBackup, restoreBackup } from '../db/backup'

export function ImportPanel() {
  const [busy, setBusy] = useState(false)
  const [csvStats, setCsvStats] = useState<ImportStats | null>(null)
  const [xlsxStats, setXlsxStats] = useState<ExcelImportStats | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setCsvStats(null)
    setXlsxStats(null)
    try {
      const csvAgg: ImportStats = {
        total: 0, imported: 0, duplicates: 0, autoCategorized: 0, toValidate: 0, errors: [],
      }
      let sawCsv = false
      let lastXlsx: ExcelImportStats | null = null

      for (const file of Array.from(files)) {
        const isExcel = /\.xlsx?$/i.test(file.name)
        if (isExcel) {
          lastXlsx = await importExcelData(await file.arrayBuffer())
        } else {
          sawCsv = true
          const s = await importCsv(await file.text())
          csvAgg.total += s.total
          csvAgg.imported += s.imported
          csvAgg.duplicates += s.duplicates
          csvAgg.autoCategorized += s.autoCategorized
          csvAgg.toValidate += s.toValidate
          csvAgg.errors.push(...s.errors)
        }
      }
      if (sawCsv) setCsvStats(csvAgg)
      if (lastXlsx) setXlsxStats(lastXlsx)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const restoreRef = useRef<HTMLInputElement>(null)

  async function handleClear() {
    if (
      !window.confirm(
        'Tout effacer : supprime TOUTES tes opérations et règles apprises (les catégories sont ' +
          'conservées). Pense à faire une sauvegarde avant. Continuer ?',
      )
    )
      return
    setBusy(true)
    try {
      await clearAllData()
      setCsvStats(null)
      setXlsxStats(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (
      !window.confirm(
        'Restaurer cette sauvegarde REMPLACERA toutes tes données actuelles. Continuer ?',
      )
    )
      return
    setBusy(true)
    try {
      const { transactions } = await restoreBackup(await file.text())
      window.alert(`Sauvegarde restaurée : ${transactions} opérations.`)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setBusy(false)
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ' +
          (dragOver
            ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
            : 'border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600')
        }
      >
        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
          {busy ? 'Traitement en cours…' : 'Dépose un export Boursorama (.csv) ou ton fichier Excel (.xlsx)'}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          CSV = nouvelles opérations · Excel = ton historique (onglet Data). Les doublons sont ignorés.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {csvStats && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Import CSV</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lignes lues" value={csvStats.total} />
            <Stat label="Ajoutées" value={csvStats.imported} tone="good" />
            <Stat label="Doublons ignorés" value={csvStats.duplicates} />
            <Stat label="À valider" value={csvStats.toValidate} tone={csvStats.toValidate ? 'warn' : 'good'} />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {csvStats.autoCategorized} opération(s) pré-catégorisée(s) automatiquement.
          </p>
          <ErrorList errors={csvStats.errors} />
        </div>
      )}

      {xlsxStats && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Import Excel (historique)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lignes Data" value={xlsxStats.totalDataRows} />
            <Stat label="Importées" value={xlsxStats.imported} tone="good" />
            <Stat label="Doublons ignorés" value={xlsxStats.duplicates} />
            <Stat label="Catégorie inconnue" value={xlsxStats.ignoredUnknownCategory} tone="warn" />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {xlsxStats.ignoredBefore2023} ligne(s) avant 2023 ignorée(s) · {xlsxStats.ignoredNoData} sans
            date/montant. Règles d'auto-catégorisation reconstruites depuis ton historique.
          </p>
          {xlsxStats.incomeImported > 0 && (
            <p className="mt-1 text-sm text-emerald-700">
              + {xlsxStats.incomeImported} revenu(s) mensuel(s) lus dans les onglets annuels
              ({new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(xlsxStats.incomeTotal)}).
            </p>
          )}
          {xlsxStats.ignoredCategories.length > 0 && (
            <details className="mt-3 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium">
                Catégories ignorées (hors de tes catégories) — {xlsxStats.ignoredCategories.length}
              </summary>
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                {xlsxStats.ignoredCategories.map((c) => (
                  <li key={c.label} className="flex justify-between gap-2">
                    <span className="truncate">{c.label}</span>
                    <span className="tabular text-slate-400">{c.count}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <ErrorList errors={xlsxStats.errors} />
        </div>
      )}

      {/* Backup / restore — the real safety net for local data */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Sauvegarde</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tes données vivent uniquement dans ce navigateur. Exporte un fichier de sauvegarde
          régulièrement (et avant de changer de PC ou de vider ton navigateur).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void exportBackup()}
            disabled={busy}
            className="rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            Exporter mes données (JSON)
          </button>
          <button
            onClick={() => restoreRef.current?.click()}
            disabled={busy}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Restaurer une sauvegarde…
          </button>
          <input
            ref={restoreRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleRestore(e.target.files)}
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
        <div className="text-sm text-rose-800 dark:text-rose-300">
          <strong>Tout effacer</strong> — supprime toutes tes opérations et règles apprises (catégories
          conservées). L'appli devient vide ; fais une sauvegarde d'abord.
        </div>
        <button
          onClick={() => void handleClear()}
          disabled={busy}
          className="shrink-0 rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          Tout effacer
        </button>
      </div>
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-600">
      {errors.slice(0, 10).map((e, i) => (
        <li key={i}>{e}</li>
      ))}
      {errors.length > 10 && <li>… {errors.length - 10} autres</li>}
    </ul>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-700'
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800">
      <div className={'tabular text-2xl font-semibold ' + color}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}
