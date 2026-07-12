// ---- Domain types ---------------------------------------------------------

export type UniversId =
  | 'revenus'
  | 'logement'
  | 'vehicule'
  | 'quotidien'
  | 'loisirs'
  | 'autre'

export interface Univers {
  id: UniversId
  label: string
  kind: 'income' | 'expense'
  order: number
}

export interface Category {
  id?: number
  name: string // stable natural key, e.g. "Courses"
  univers: UniversId
  order: number
  /** Monthly spend at/under which the category is "on track" (green). */
  seuilSucces?: number | null
  /** Monthly spend at/over which the category is in alert (red). */
  seuilAlerte?: number | null
}

/** A learned or manual mapping from a merchant/label pattern to a category. */
export interface Rule {
  id?: number
  matchType: 'supplier' | 'labelContains'
  /** Normalized pattern (lowercased, trimmed, accents kept). */
  pattern: string
  category: string // Category.name (ignored when ambiguous)
  /**
   * Passthrough merchant (Amazon, PayPal, Google Play…) whose purchases span
   * several categories: never auto-filled, always left to validate. Set at
   * seed time or auto-detected when the user files the same merchant under
   * two different categories.
   */
  ambiguous?: boolean
  /** How many times this mapping has been confirmed — used for confidence. */
  count: number
  /** 'starter' = shipped default, 'learned' = derived from user validation. */
  source: 'starter' | 'learned' | 'manual'
  updatedAt: number
}

export interface Transaction {
  id?: number
  /** Composite dedupe key: accountNum|dateOp|label|amount|balance */
  dedupeKey: string
  dateOp: string // ISO yyyy-mm-dd
  dateVal: string // ISO yyyy-mm-dd
  year: number
  month: number // 1-12
  label: string
  supplier: string // raw supplierFound from the bank
  bankCategory: string // bank's own category (kept for reference)
  bankCategoryParent: string
  amount: number // negative = expense, positive = income
  comment: string
  accountNum: string
  accountLabel: string
  balance: number | null
  /** User category (Category.name) or null when awaiting validation. */
  category: string | null
  /** true once the user has confirmed/edited the category. */
  validated: boolean
  /** Excluded from all aggregations (transfers, refunds, duplicates…) but kept in the list. */
  ignored?: boolean
  /** How the category was first assigned. */
  categorySource: 'auto' | 'manual' | null
  importedAt: number
}
