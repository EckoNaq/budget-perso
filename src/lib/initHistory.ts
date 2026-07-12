import { importExcelData } from './xlsxImport'

/** localStorage flag so the bundled history loads only once. */
export const HISTORY_FLAG = 'histImported_v1'

/**
 * On first launch, initialize the app with the historical operations bundled
 * with it (public/historique.xlsx — a copy of the user's Excel, gitignored).
 * Runs at most once (guarded by a localStorage flag) and is dedup-safe.
 * Returns import stats, or null if there's nothing to do / no file.
 *
 * Memoized: React StrictMode invokes effects twice in dev, so concurrent
 * calls MUST share a single execution or the history gets imported twice.
 */
let initPromise: Promise<{ imported: number; income: number } | null> | null = null

export function initHistoryOnce(): Promise<{ imported: number; income: number } | null> {
  if (!initPromise) initPromise = doInit()
  return initPromise
}

async function doInit(): Promise<{ imported: number; income: number } | null> {
  if (localStorage.getItem(HISTORY_FLAG)) return null

  let buffer: ArrayBuffer
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}historique.xlsx`)
    if (!res.ok) return null
    buffer = await res.arrayBuffer()
  } catch {
    return null
  }

  // Guard against the SPA fallback returning index.html: a real .xlsx is a
  // ZIP starting with the bytes "PK".
  const head = new Uint8Array(buffer.slice(0, 2))
  if (head[0] !== 0x50 || head[1] !== 0x4b) return null

  const stats = await importExcelData(buffer)
  localStorage.setItem(HISTORY_FLAG, String(Date.now()))
  return { imported: stats.imported, income: stats.incomeImported }
}
