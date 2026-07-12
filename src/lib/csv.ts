import Papa from 'papaparse'
import type { Transaction } from '../db/types'
import { normalize, parseAmount } from './text'

/** Raw row shape from a Boursorama CSV export. */
interface BoursoRow {
  dateOp: string
  dateVal: string
  label: string
  category: string
  categoryParent: string
  supplierFound: string
  amount: string
  comment: string
  accountNum: string
  accountLabel: string
  accountbalance: string
}

export interface ParsedTransaction
  extends Omit<Transaction, 'id' | 'category' | 'validated' | 'categorySource' | 'importedAt'> {}

export interface ParseResult {
  rows: ParsedTransaction[]
  errors: string[]
}

const REQUIRED_COLUMNS = ['dateOp', 'label', 'amount', 'accountNum']

export function buildDedupeKey(t: {
  accountNum: string
  dateOp: string
  label: string
  amount: number
  balance: number | null
}): string {
  // Normalize the account number so the same operation dedupes whether it
  // comes from a CSV ("00040201170") or the Excel Data tab ("40201170").
  const acct = String(t.accountNum ?? '').replace(/^0+/, '')
  return [acct, t.dateOp, normalize(t.label), t.amount.toFixed(2), t.balance ?? ''].join('|')
}

/**
 * Parse a Boursorama CSV (semicolon-delimited, French amounts, ISO dates).
 */
export function parseBoursoramaCsv(text: string): ParseResult {
  const parsed = Papa.parse<BoursoRow>(text, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const errors: string[] = []
  const headers = parsed.meta.fields ?? []
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
  if (missing.length) {
    errors.push(
      `Colonnes manquantes dans le CSV : ${missing.join(', ')}. ` +
        `Colonnes attendues type Boursorama (dateOp;dateVal;label;...).`,
    )
    return { rows: [], errors }
  }

  const rows: ParsedTransaction[] = []
  parsed.data.forEach((r, i) => {
    const dateOp = (r.dateOp || '').trim()
    if (!dateOp) return
    const amount = parseAmount(r.amount)
    if (Number.isNaN(amount)) {
      errors.push(`Ligne ${i + 2} : montant illisible ("${r.amount}") — ignorée.`)
      return
    }
    const balanceNum = parseAmount(r.accountbalance)
    const balance = Number.isNaN(balanceNum) ? null : balanceNum
    const [y, m] = dateOp.split('-').map(Number)
    const accountNum = (r.accountNum || '').trim()
    const label = (r.label || '').trim()

    rows.push({
      dedupeKey: buildDedupeKey({ accountNum, dateOp, label, amount, balance }),
      dateOp,
      dateVal: (r.dateVal || dateOp).trim(),
      year: y,
      month: m,
      label,
      supplier: (r.supplierFound || '').trim(),
      bankCategory: (r.category || '').trim(),
      bankCategoryParent: (r.categoryParent || '').trim(),
      amount,
      comment: (r.comment || '').trim(),
      accountNum,
      accountLabel: (r.accountLabel || '').trim(),
      balance,
    })
  })

  return { rows, errors }
}
