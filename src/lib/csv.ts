import Papa from 'papaparse'
import type { Transaction } from '../db/types'
import { normalize, parseAmount } from './text'

/** Raw row shape from a Boursorama CSV export (handles both export formats). */
interface BoursoRow {
  dateOp: string
  dateVal: string
  label: string
  /** Newer exports: clean merchant name (replaces supplierFound). */
  suggestedLabel?: string
  category: string
  categoryParent: string
  /** Older exports only. */
  supplierFound?: string
  amount: string
  comment: string
  accountNum: string
  accountLabel: string
  accountbalance: string
}

/**
 * The stable core of a bank label, used for dedup. Boursorama exports the label
 * either as "Titre | LIBELLÉ BRUT" (old format) or just "LIBELLÉ BRUT" (new).
 * Keeping the part after the last "|" makes both formats match.
 */
export function labelCore(label: string): string {
  const raw = label ?? ''
  const i = raw.lastIndexOf('|')
  return i >= 0 ? raw.slice(i + 1) : raw
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
  balance?: number | null
}): string {
  // Key must be stable across export formats:
  //  - account number normalized (leading zeros: "00040201170" == "40201170")
  //  - label reduced to its stable core ("Titre | RAW" == "RAW")
  //  - NO balance: the bank reports a different day-balance between exports.
  const acct = String(t.accountNum ?? '').replace(/^0+/, '')
  return [acct, t.dateOp, normalize(labelCore(t.label)), t.amount.toFixed(2)].join('|')
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
      // Old exports carry supplierFound; new ones carry suggestedLabel instead.
      supplier: (r.supplierFound || r.suggestedLabel || '').trim(),
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
