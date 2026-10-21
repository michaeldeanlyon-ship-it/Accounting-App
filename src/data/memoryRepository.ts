import { validateDayMinutes } from '../domain/duration'
import type { Deduction, Expense } from '../domain/expense'
import { validateForSending, type Invoice } from '../domain/invoice'
import { formatInvoiceNumber, type Person } from '../domain/person'
import { paramsForYear, type TaxYearParams } from '../domain/tax/params'
import type { TimeEntry } from '../domain/timesheet'
import type { Seed } from './demoSeed'
import { describeChange, type AuditEntry, type Repository, type Session } from './repository'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface State extends Seed {
  audit: AuditEntry[]
  taxParams: Record<number, TaxYearParams>
}

const DEMO_SESSION: Session = { userId: 'demo', email: 'demo@ledger.app' }

/** In-memory repository for demo mode and tests. Optionally persists to localStorage-like storage. */
export function createMemoryRepository(options: { seed: Seed; storage?: KeyValueStorage; storageKey?: string }): Repository {
  const key = options.storageKey ?? 'ledger-demo-v1'
  const saved = options.storage?.getItem(key)
  const state: State = saved ? JSON.parse(saved) : { ...structuredClone(options.seed), audit: [], taxParams: {} }
  let session: Session | null = DEMO_SESSION
  const listeners = new Set<(s: Session | null) => void>()
  const receiptUrls = new Map<string, string>()

  const persist = () => options.storage?.setItem(key, JSON.stringify(state))
  const clone = <T>(value: T): T => structuredClone(value)
  const newId = () => crypto.randomUUID()
  const done = <T>(value: T) => {
    persist()
    return Promise.resolve(clone(value))
  }
  const upsert = <T extends { id: string }>(list: T[], item: T): T => {
    const withId = { ...item, id: item.id || newId() }
    const index = list.findIndex((x) => x.id === withId.id)
    if (index >= 0) list[index] = withId
    else list.push(withId)
    return withId
  }
  const notify = () => listeners.forEach((l) => l(session))

  const findInvoice = (id: string) => {
    const invoice = state.invoices.find((i) => i.id === id)
    if (!invoice) throw new Error('Invoice not found')
    return invoice
  }

  return {
    mode: 'demo',

    getSession: () => Promise.resolve(session),
    async signIn(email) {
      session = { userId: 'demo', email }
      notify()
    },
    async signOut() {
      session = null
      notify()
    },
    onAuthChange(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    myPersonId: () => Promise.resolve(null),

    listPeople: () => Promise.resolve(clone(state.people)),
    savePerson(person: Person) {
      return done(upsert(state.people, person))
    },

    listInvoices: () => Promise.resolve(clone(state.invoices)),
    saveInvoice(invoice: Invoice) {
      const previous = invoice.id ? state.invoices.find((i) => i.id === invoice.id) : undefined
      const saved = upsert(state.invoices, clone(invoice))
      if (previous && previous.status !== 'draft') {
        const summary = describeChange(previous as unknown as Record<string, unknown>, saved as unknown as Record<string, unknown>)
        state.audit.push({ id: newId(), invoiceId: saved.id, changedAt: new Date().toISOString(), changedBy: session?.email ?? null, summary })
      }
      return done(saved)
    },
    async sendInvoice(id) {
      const invoice = findInvoice(id)
      if (invoice.status !== 'draft') return clone(invoice)
      const errors = validateForSending(invoice)
      if (errors.length) throw new Error(errors.join('. '))
      const person = state.people.find((p) => p.id === invoice.ownerId)
      if (!person) throw new Error('Unknown person')
      invoice.number = formatInvoiceNumber(person.invoicePrefix, person.nextInvoiceNumber)
      person.nextInvoiceNumber += 1
      invoice.status = 'sent'
      return done(invoice)
    },
    async deleteDraft(id) {
      const invoice = findInvoice(id)
      if (invoice.status !== 'draft') throw new Error('Sent invoices cannot be deleted. Issue a credit note instead.')
      state.invoices = state.invoices.filter((i) => i.id !== id)
      state.timeEntries = state.timeEntries.map((e) => (e.invoiceId === id ? { ...e, invoiceId: null } : e))
      persist()
    },
    listAuditLog: (invoiceId) =>
      Promise.resolve(clone(state.audit.filter((a) => a.invoiceId === invoiceId).sort((a, b) => b.changedAt.localeCompare(a.changedAt)))),

    listTimeEntries: () => Promise.resolve(clone(state.timeEntries)),
    async saveTimeEntry(entry: TimeEntry) {
      const error = validateDayMinutes(entry.minutes)
      if (error) throw new Error(error)
      return done(upsert(state.timeEntries, entry))
    },
    async deleteTimeEntry(id) {
      state.timeEntries = state.timeEntries.filter((e) => e.id !== id)
      persist()
    },
    async setTimeEntriesInvoice(ids, invoiceId) {
      const wanted = new Set(ids)
      if (invoiceId) {
        const clash = state.timeEntries.filter((e) => wanted.has(e.id) && e.invoiceId !== null && e.invoiceId !== invoiceId)
        if (clash.length) throw new Error(`${clash.map((e) => e.workDate).join(', ')} is already on an invoice`)
      }
      state.timeEntries = state.timeEntries.map((e) => (wanted.has(e.id) ? { ...e, invoiceId } : e))
      persist()
    },

    listExpenses: () => Promise.resolve(clone(state.expenses)),
    saveExpense(expense: Expense) {
      return done(upsert(state.expenses, expense))
    },
    async deleteExpense(id) {
      state.expenses = state.expenses.filter((e) => e.id !== id)
      persist()
    },
    async uploadReceipt(expenseId, file) {
      const path = `demo/${expenseId}/${file.name}`
      receiptUrls.set(path, typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '')
      return path
    },
    receiptUrl: (path) => Promise.resolve(receiptUrls.get(path) ?? ''),

    listDeductions: () => Promise.resolve(clone(state.deductions)),
    saveDeduction(deduction: Deduction) {
      return done(upsert(state.deductions, deduction))
    },
    async deleteDeduction(id) {
      state.deductions = state.deductions.filter((d) => d.id !== id)
      persist()
    },

    getTaxParams: (year) => Promise.resolve(clone(state.taxParams[year] ?? paramsForYear(year))),
    async saveTaxParams(params) {
      state.taxParams[params.year] = clone(params)
      persist()
    },
  }
}
