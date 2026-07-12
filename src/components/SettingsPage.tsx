import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { UniversId } from '../db/types'
import { UNIVERS } from '../db/seed'
import {
  addCategory,
  deleteCategory,
  moveCategory,
  renameAccount,
  renameCategory,
  setCategoryUnivers,
} from '../db/adminOps'
import { buildDedupeKey } from '../lib/csv'
import { CategorySelect } from './CategorySelect'

const cardCls = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const inputCls =
  'rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
const btnCls =
  'rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className={cardCls}>
      <h3 className="font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {desc && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  return (
    <div className="space-y-5">
      <NewTransactionForm />
      <BudgetsEditor />
      <CategoriesEditor />
      <RulesEditor />
      <AccountsSettings />
    </div>
  )
}

// 1) Manual transaction ------------------------------------------------------
function NewTransactionForm() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [account, setAccount] = useState('Compte principal')
  const [category, setCategory] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    const raw = Number(amount.replace(',', '.'))
    if (!label.trim() || !Number.isFinite(raw) || raw === 0 || !category) {
      setMsg('Renseigne un libellé, un montant non nul et une catégorie.')
      return
    }
    const signed = type === 'income' ? Math.abs(raw) : -Math.abs(raw)
    const [y, m] = date.split('-').map(Number)
    await db.transactions.add({
      dedupeKey: buildDedupeKey({ accountNum: 'manuel', dateOp: date, label, amount: signed, balance: null }) + '|m' + Date.now(),
      dateOp: date,
      dateVal: date,
      year: y,
      month: m,
      label: label.trim(),
      supplier: '',
      bankCategory: '',
      bankCategoryParent: '',
      amount: signed,
      comment: '',
      accountNum: 'manuel',
      accountLabel: account.trim() || 'Compte principal',
      balance: null,
      category,
      validated: true,
      categorySource: 'manual',
      importedAt: Date.now(),
    })
    setLabel('')
    setAmount('')
    setCategory(null)
    setMsg('Transaction ajoutée ✓')
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <Section title="Nouvelle transaction" desc="Ajoute une opération à la main (elle compte comme validée).">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <input placeholder="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as 'expense' | 'income')} className={inputCls}>
            <option value="expense">Dépense</option>
            <option value="income">Revenu</option>
          </select>
          <input
            placeholder="Montant"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls + ' w-28'}
          />
        </div>
        <input placeholder="Compte" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls} />
        <CategorySelect value={category} onChange={setCategory} />
        <button onClick={() => void submit()} className={btnCls}>Ajouter</button>
      </div>
      {msg && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
    </Section>
  )
}

// 2) Budgets & thresholds ----------------------------------------------------
function BudgetsEditor() {
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  if (!cats) return null
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
  return (
    <Section title="Budgets & seuils" desc="Seuil Succès (vert si ≤) et Alerte (rouge si ≥) par catégorie.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1">Catégorie</th>
              <th className="py-1">Succès</th>
              <th className="py-1">Alerte</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 pr-3 text-slate-700 dark:text-slate-200">{c.name}</td>
                <td className="py-1 pr-3">
                  <input
                    type="number"
                    defaultValue={c.seuilSucces ?? ''}
                    onBlur={(e) => void db.categories.update(c.id!, { seuilSucces: num(e.target.value) })}
                    className={inputCls + ' w-24'}
                  />
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    defaultValue={c.seuilAlerte ?? ''}
                    onBlur={(e) => void db.categories.update(c.id!, { seuilAlerte: num(e.target.value) })}
                    className={inputCls + ' w-24'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// 3) Categories & univers ----------------------------------------------------
function CategoriesEditor() {
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const [newName, setNewName] = useState('')
  const [newUniv, setNewUniv] = useState<UniversId>('quotidien')
  const [err, setErr] = useState<string | null>(null)

  async function add() {
    try {
      await addCategory(newName, newUniv)
      setNewName('')
      setErr(null)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  async function rename(id: number, name: string) {
    try {
      await renameCategory(id, name)
      setErr(null)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  async function remove(id: number, name: string) {
    if (!window.confirm(`Supprimer « ${name} » ? Ses opérations passeront en « Inconnu ».`)) return
    try {
      await deleteCategory(id)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (!cats) return null
  return (
    <Section title="Catégories & univers" desc="Renomme, réordonne, change d'univers ou supprime tes catégories.">
      {err && <p className="mb-2 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="space-y-1">
        {cats.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <input
              key={c.name}
              defaultValue={c.name}
              onBlur={(e) => void rename(c.id!, e.target.value)}
              className={inputCls + ' flex-1 min-w-[10rem]'}
            />
            <select
              value={c.univers}
              onChange={(e) => void setCategoryUnivers(c.id!, e.target.value as UniversId)}
              className={inputCls}
            >
              {UNIVERS.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
            <button onClick={() => void moveCategory(c.id!, -1)} className="px-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100" title="Monter">▲</button>
            <button onClick={() => void moveCategory(c.id!, 1)} className="px-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100" title="Descendre">▼</button>
            <button onClick={() => void remove(c.id!, c.name)} className="px-2 text-rose-500 hover:text-rose-700" title="Supprimer">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <input placeholder="Nouvelle catégorie" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
        <select value={newUniv} onChange={(e) => setNewUniv(e.target.value as UniversId)} className={inputCls}>
          {UNIVERS.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
        <button onClick={() => void add()} className={btnCls}>Ajouter</button>
      </div>
    </Section>
  )
}

// 4) Rules -------------------------------------------------------------------
function RulesEditor() {
  const rules = useLiveQuery(() => db.rules.toArray(), [])
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    if (!rules) return []
    const s = q.trim().toLowerCase()
    return rules
      .filter((r) => !s || r.pattern.includes(s) || r.category.toLowerCase().includes(s))
      .sort((a, b) => a.pattern.localeCompare(b.pattern))
  }, [rules, q])

  if (!rules) return null
  return (
    <Section
      title="Règles d'auto-catégorisation"
      desc={`${rules.length} règle(s). Un commerçant « ambigu » n'est jamais deviné (laissé à valider).`}
    >
      <input placeholder="Rechercher un commerçant…" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls + ' mb-2 w-full'} />
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="py-1">Commerçant</th>
              <th className="py-1">Catégorie</th>
              <th className="py-1 text-center">Ambigu</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 pr-3 text-slate-700 dark:text-slate-200">{r.pattern}</td>
                <td className="py-1 pr-3">
                  <CategorySelect value={r.category || null} onChange={(cat) => void db.rules.update(r.id!, { category: cat, ambiguous: false })} />
                </td>
                <td className="py-1 text-center">
                  <input
                    type="checkbox"
                    checked={!!r.ambiguous}
                    onChange={(e) => void db.rules.update(r.id!, { ambiguous: e.target.checked })}
                  />
                </td>
                <td className="py-1 text-right">
                  <button onClick={() => void db.rules.delete(r.id!)} className="px-2 text-rose-500 hover:text-rose-700" title="Supprimer">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && <p className="p-2 text-center text-xs text-slate-400">Affichage limité à 300 — affine la recherche.</p>}
      </div>
    </Section>
  )
}

// 5) Accounts ----------------------------------------------------------------
function AccountsSettings() {
  const txs = useLiveQuery(() => db.transactions.toArray(), [])
  const accounts = useMemo(() => {
    const m = new Map<string, string>()
    txs?.forEach((t) => {
      if (t.accountNum && !m.has(t.accountNum)) m.set(t.accountNum, t.accountLabel)
    })
    return [...m.entries()]
  }, [txs])

  return (
    <Section title="Comptes" desc="Renomme le libellé d'un compte (appliqué à toutes ses opérations).">
      {accounts.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Aucun compte pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map(([num, label]) => (
            <div key={num} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-xs text-slate-400">{num}</span>
              <input
                key={label}
                defaultValue={label}
                onBlur={(e) => void renameAccount(num, e.target.value)}
                className={inputCls + ' flex-1'}
              />
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        💾 Pense à exporter une sauvegarde régulièrement (onglet <strong>Import</strong>) — tes données sont locales.
      </p>
    </Section>
  )
}
