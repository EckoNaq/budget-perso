import Dexie, { type Table } from 'dexie'
import type { Category, Rule, Transaction } from './types'

/**
 * Local-only database (IndexedDB). Nothing ever leaves the browser.
 */
export class BudgetDB extends Dexie {
  transactions!: Table<Transaction, number>
  categories!: Table<Category, number>
  rules!: Table<Rule, number>

  constructor() {
    super('budget-perso')
    this.version(1).stores({
      // Indexed fields only — other fields are stored but not indexed.
      transactions: '++id, dedupeKey, year, month, category, validated, accountNum, supplier',
      categories: '++id, &name, univers, order',
      rules: '++id, &pattern, category, matchType',
    })
  }
}

export const db = new BudgetDB()
