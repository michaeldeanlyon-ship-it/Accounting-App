import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deduction, Expense } from '../domain/expense'
import { validateForSending, type Invoice } from '../domain/invoice'
import type { Person } from '../domain/person'
import { paramsForYear, type TaxYearParams } from '../domain/tax/params'
import type { TimeEntry } from '../domain/timesheet'
import { describeChange, type AuditEntry, type Repository, type Session } from './repository'
import {
  deductionFromRow, deductionToRow, expenseFromRow, expenseToRow, invoiceFromRow, invoiceToRpc, personFromRow, personToRow,
  timeEntryFromRow, timeEntryToRow, type Row,
} from './supabaseMappers'

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

const withId = <T extends { id: string }>(item: T): T => ({ ...item, id: item.id || crypto.randomUUID() })

/** Production repository backed by Supabase (Postgres + RLS, Auth, Storage). */
export function createSupabaseRepository(client: SupabaseClient): Repository {
  const toSession = (user: { id: string; email?: string } | null | undefined): Session | null =>
    user ? { userId: user.id, email: user.email ?? '' } : null

  const fetchInvoice = async (id: string) =>
    invoiceFromRow(check(await client.from('invoices').select('*, invoice_lines(*)').eq('id', id).single()) as Row)

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await client.auth.getSession()
      return toSession(data.session?.user)
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message)
    },
    async signOut() {
      await client.auth.signOut()
    },
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(toSession(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async myPersonId() {
      const { data } = await client.auth.getUser()
      if (!data.user) return null
      const row = check(await client.from('workspace_members').select('person_id').eq('user_id', data.user.id).maybeSingle())
      return (row as Row | null)?.person_id ? String((row as Row).person_id) : null
    },

    async listPeople() {
      return (check(await client.from('people').select('*').order('created_at')) as Row[]).map(personFromRow)
    },
    async savePerson(person: Person) {
      return personFromRow(check(await client.from('people').upsert(personToRow(withId(person))).select().single()) as Row)
    },

    async listInvoices() {
      return (check(await client.from('invoices').select('*, invoice_lines(*)').order('issue_date', { ascending: false })) as Row[]).map(invoiceFromRow)
    },
    async saveInvoice(invoice: Invoice) {
      const saved = withId(invoice)
      check(await client.rpc('save_invoice', invoiceToRpc(saved)))
      return fetchInvoice(saved.id)
    },
    async sendInvoice(id) {
      const invoice = await fetchInvoice(id)
      if (invoice.status === 'draft') {
        const errors = validateForSending(invoice)
        if (errors.length) throw new Error(errors.join('. '))
        check(await client.rpc('send_invoice', { p_id: id }))
      }
      return fetchInvoice(id)
    },
    async deleteDraft(id) {
      check(await client.from('invoices').delete().eq('id', id))
    },
    async listAuditLog(invoiceId) {
      const rows = check(await client.from('audit_log').select('*').eq('invoice_id', invoiceId).order('changed_at', { ascending: false })) as Row[]
      return rows.map((r): AuditEntry => ({
        id: String(r.id),
        invoiceId,
        changedAt: String(r.changed_at),
        changedBy: r.changed_by ? String(r.changed_by) : null,
        summary: r.table_name === 'invoice_lines'
          ? 'Changed lines'
          : describeChange((r.old_row as Row) ?? {}, (r.new_row as Row) ?? {}),
      }))
    },

    async listTimeEntries() {
      return (check(await client.from('time_entries').select('*').order('work_date', { ascending: false })) as Row[]).map(timeEntryFromRow)
    },
    async saveTimeEntry(entry: TimeEntry) {
      return timeEntryFromRow(check(await client.from('time_entries').upsert(timeEntryToRow(withId(entry))).select().single()) as Row)
    },
    async deleteTimeEntry(id) {
      check(await client.from('time_entries').delete().eq('id', id))
    },
    async setTimeEntriesInvoice(ids, invoiceId) {
      if (ids.length === 0) return
      if (invoiceId) {
        const rows = check(await client.from('time_entries').select('id, work_date, invoice_id').in('id', ids)) as Row[]
        const clash = rows.filter((r) => r.invoice_id && r.invoice_id !== invoiceId)
        if (clash.length) throw new Error(`${clash.map((r) => r.work_date).join(', ')} is already on an invoice`)
      }
      check(await client.from('time_entries').update({ invoice_id: invoiceId }).in('id', ids))
    },

    async listExpenses() {
      return (check(await client.from('expenses').select('*').order('expense_date', { ascending: false })) as Row[]).map(expenseFromRow)
    },
    async saveExpense(expense: Expense) {
      return expenseFromRow(check(await client.from('expenses').upsert(expenseToRow(withId(expense))).select().single()) as Row)
    },
    async deleteExpense(id) {
      check(await client.from('expenses').delete().eq('id', id))
    },
    async uploadReceipt(expenseId, file) {
      const path = `${expenseId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await client.storage.from('receipts').upload(path, file, { upsert: false })
      if (error) throw new Error(error.message)
      return path
    },
    async receiptUrl(path) {
      const { data, error } = await client.storage.from('receipts').createSignedUrl(path, 60 * 60)
      if (error) throw new Error(error.message)
      return data.signedUrl
    },

    async listDeductions() {
      return (check(await client.from('deductions').select('*').order('created_at')) as Row[]).map(deductionFromRow)
    },
    async saveDeduction(deduction: Deduction) {
      return deductionFromRow(check(await client.from('deductions').upsert(deductionToRow(withId(deduction))).select().single()) as Row)
    },
    async deleteDeduction(id) {
      check(await client.from('deductions').delete().eq('id', id))
    },

    async getTaxParams(year) {
      const row = check(await client.from('tax_year_params').select('params').eq('year', year).maybeSingle()) as Row | null
      return (row?.params as TaxYearParams | undefined) ?? paramsForYear(year)
    },
    async saveTaxParams(params) {
      check(await client.from('tax_year_params').upsert({ year: params.year, params }))
    },
  }
}
