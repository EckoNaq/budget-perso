import * as XLSX from 'xlsx'
import type { Transaction } from '../db/types'
import { canonicalizeCategory } from './categoryMap'
import { buildDedupeKey } from './csv'
import { rebuildLearnedRules } from './categorize'
import { persistNewTransactions } from './import'

export interface ExcelImportStats {
  totalDataRows: number
  imported: number
  duplicates: number
  ignoredUnknownCategory: number
  ignoredBefore2023: number
  ignoredNoData: number
  /** Income rows read from the yearly sheets (Salaire/Bonus/Divers). */
  incomeImported: number
  incomeTotal: number
  /** Distinct col-D labels that were ignored (not one of your categories). */
  ignoredCategories: { label: string; count: number }[]
  errors: string[]
}

// Income block labels in the yearly sheets → app categories.
const INCOME_LABELS: Record<string, string> = {
  salaire: 'Salaire',
  bonus: 'Bonus',
  divers: 'Divers revenus',
}

const MIN_YEAR = 2023

/** Excel (1900 system) serial date → ISO yyyy-mm-dd. */
function serialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Parse a date cell: Excel serial, ISO yyyy-mm-dd, or French dd/mm/yyyy. */
function parseDateCell(v: unknown): string | null {
  if (typeof v === 'number') return serialToIso(v)
  if (typeof v === 'string' && v.trim()) {
    const s = v.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    // French text date: dd/mm/yyyy (also dd-mm-yyyy or dd.mm.yyyy)
    const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
    if (fr) {
      const [, d, m, y] = fr
      const year = y.length === 2 ? 2000 + Number(y) : Number(y)
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const n = Number(s)
    if (Number.isFinite(n)) return serialToIso(n)
  }
  return null
}

/**
 * Read the monthly income (Salaire/Bonus/Divers) hand-entered in each yearly
 * sheet (named like "2026"). Those amounts are NOT in the Data tab.
 */
function parseYearlyIncome(wb: XLSX.WorkBook, now: number): { rows: Transaction[]; total: number } {
  const rows: Transaction[] = []
  let total = 0
  for (const sheetName of wb.SheetNames) {
    if (!/^\d{4}$/.test(sheetName.trim())) continue
    const year = Number(sheetName.trim())
    if (year < MIN_YEAR) continue
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
    })
    for (const r of grid) {
      if (!r) continue
      const label = String(r[1] ?? '').trim().toLowerCase()
      const category = INCOME_LABELS[label]
      if (!category) continue
      // Month columns C..N = indices 2..13 (Jan..Dec).
      for (let m = 0; m < 12; m++) {
        const amount = toNumber(r[2 + m])
        if (!Number.isFinite(amount) || amount === 0) continue
        total += amount
        rows.push({
          dedupeKey: `manual-income|${year}|${m + 1}|${category}`,
          dateOp: `${year}-${String(m + 1).padStart(2, '0')}-01`,
          dateVal: `${year}-${String(m + 1).padStart(2, '0')}-01`,
          year,
          month: m + 1,
          label: `${category} (saisie annuelle ${year})`,
          supplier: '',
          bankCategory: '',
          bankCategoryParent: '',
          amount,
          comment: '',
          accountNum: '',
          accountLabel: 'Saisie annuelle',
          balance: null,
          category,
          validated: true,
          categorySource: 'manual',
          importedAt: now,
        })
      }
    }
  }
  return { rows, total }
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[  \s]/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

/**
 * Import the "Data" sheet of the user's Excel workbook. Only rows whose
 * column-D category is one of the user's own categories (case/accents
 * insensitive) and dated 2023+ are imported; everything else is ignored.
 * Learned rules are then rebuilt from the full history.
 */
export async function importExcelData(buffer: ArrayBuffer): Promise<ExcelImportStats> {
  const stats: ExcelImportStats = {
    totalDataRows: 0,
    imported: 0,
    duplicates: 0,
    ignoredUnknownCategory: 0,
    ignoredBefore2023: 0,
    ignoredNoData: 0,
    incomeImported: 0,
    incomeTotal: 0,
    ignoredCategories: [],
    errors: [],
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch {
    stats.errors.push('Fichier Excel illisible.')
    return stats
  }

  const sheetName = wb.SheetNames.find((n) => n.trim().toLowerCase() === 'data')
  if (!sheetName) {
    stats.errors.push(`Onglet "Data" introuvable. Onglets trouvés : ${wb.SheetNames.join(', ')}.`)
    return stats
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: '',
  })

  const now = Date.now()
  const ignoredCats = new Map<string, number>()
  const prepared: Transaction[] = []

  // Column layout: A dateOp, B dateVal, C label, D category, E parent,
  // F supplier, G amount, H note, I accountNum, J accountLabel, K balance.
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i]
    if (!r || (!r[0] && !r[2])) continue
    stats.totalDataRows++

    const dateOp = parseDateCell(r[0])
    const amount = toNumber(r[6])
    if (!dateOp || Number.isNaN(amount)) {
      stats.ignoredNoData++
      continue
    }
    const year = Number(dateOp.slice(0, 4))
    if (year < MIN_YEAR) {
      stats.ignoredBefore2023++
      continue
    }

    const rawCat = String(r[3] ?? '').trim()
    const category = canonicalizeCategory(rawCat)
    if (!category) {
      stats.ignoredUnknownCategory++
      if (rawCat) ignoredCats.set(rawCat, (ignoredCats.get(rawCat) ?? 0) + 1)
      continue
    }

    const dateVal = parseDateCell(r[1]) ?? dateOp
    const label = String(r[2] ?? '').trim()
    const supplier = String(r[5] ?? '').trim()
    const accountNum = String(r[8] ?? '').trim()
    const balNum = toNumber(r[10])
    const balance = Number.isNaN(balNum) ? null : balNum
    const [, m] = dateOp.split('-').map(Number)

    prepared.push({
      dedupeKey: buildDedupeKey({ accountNum, dateOp, label, amount, balance }),
      dateOp,
      dateVal,
      year,
      month: m,
      label,
      supplier,
      bankCategory: '',
      bankCategoryParent: String(r[4] ?? '').trim(),
      amount,
      comment: String(r[7] ?? '').trim(),
      accountNum,
      accountLabel: String(r[9] ?? '').trim(),
      balance,
      category,
      validated: true, // these are the user's own manual categorizations
      categorySource: 'manual',
      importedAt: now,
    })
  }

  // Income hand-entered in the yearly sheets (absent from the Data tab).
  const income = parseYearlyIncome(wb, now)
  stats.incomeImported = income.rows.length
  stats.incomeTotal = income.total

  const { imported, duplicates } = await persistNewTransactions([...prepared, ...income.rows])
  stats.imported = imported
  stats.duplicates = duplicates
  stats.ignoredCategories = [...ignoredCats.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  await rebuildLearnedRules()
  return stats
}
