import type { Deduction, Expense } from '../domain/expense'
import type { Invoice } from '../domain/invoice'
import type { Person } from '../domain/person'
import type { TaxYearParams } from '../domain/tax/params'
import type { TimeEntry } from '../domain/timesheet'

export interface Session {
  userId: string
  email: string
}

export interface AuditEntry {
  id: string
  invoiceId: string
  changedAt: string
  changedBy: string | null
  summary: string
}

/**
 * Everything the UI needs from storage. Implemented in memory (demo mode and tests)
 * and on Supabase (production). Ids passed as '' are created by the repository.
 */
export interface Repository {
  readonly mode: 'demo' | 'supabase'

  getSession(): Promise<Session | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  onAuthChange(callback: (session: Session | null) => void): () => void
  /** The person record linked to the signed-in user, if any. */
  myPersonId(): Promise<string | null>

  listPeople(): Promise<Person[]>
  savePerson(person: Person): Promise<Person>

  listInvoices(): Promise<Invoice[]>
  saveInvoice(invoice: Invoice): Promise<Invoice>
  /** Validates, assigns the next number in the owner's series and marks the invoice as sent. */
  sendInvoice(id: string): Promise<Invoice>
  /** Only drafts can be deleted; their time entries become unbilled again. */
  deleteDraft(id: string): Promise<void>
  listAuditLog(invoiceId: string): Promise<AuditEntry[]>

  listTimeEntries(): Promise<TimeEntry[]>
  saveTimeEntry(entry: TimeEntry): Promise<TimeEntry>
  deleteTimeEntry(id: string): Promise<void>
  setTimeEntriesInvoice(ids: string[], invoiceId: string | null): Promise<void>

  listExpenses(): Promise<Expense[]>
  saveExpense(expense: Expense): Promise<Expense>
  deleteExpense(id: string): Promise<void>
  uploadReceipt(expenseId: string, file: File): Promise<string>
  receiptUrl(path: string): Promise<string>

  listDeductions(): Promise<Deduction[]>
  saveDeduction(deduction: Deduction): Promise<Deduction>
  deleteDeduction(id: string): Promise<void>

  getTaxParams(year: number): Promise<TaxYearParams>
  saveTaxParams(params: TaxYearParams): Promise<void>
}

const FIELD_LABELS: Record<string, string> = {
  number: 'number', clientName: 'client', client_name: 'client', clientAddress: 'client address', client_address: 'client address',
  clientOrgNumber: 'client org nr', client_org_number: 'client org nr', clientVatNumber: 'client VAT nr', client_vat_number: 'client VAT nr',
  issueDate: 'issue date', issue_date: 'issue date', dueDate: 'due date', due_date: 'due date', currency: 'currency',
  fxRateToSek: 'exchange rate', fx_rate_to_sek: 'exchange rate', vatTreatment: 'VAT treatment', vat_treatment: 'VAT treatment',
  status: 'status', paidDate: 'payment', paid_date: 'payment', paidAmount: 'payment', paid_amount: 'payment', notes: 'notes', lines: 'lines',
}

/** "Changed due date, lines" from the keys that differ between two versions of a record. */
export function describeChange(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const labels = new Set<string>()
  for (const key of Object.keys(FIELD_LABELS)) {
    if (!(key in before) && !(key in after)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) labels.add(FIELD_LABELS[key])
  }
  return labels.size ? `Changed ${[...labels].join(', ')}` : 'Saved without changes'
}
