import type { Deduction, Expense, ExpenseCategory, Housing } from '../domain/expense'
import type { Invoice, InvoiceLine, InvoiceRecordStatus } from '../domain/invoice'
import type { Currency } from '../domain/money'
import type { AccountingMethod, Person, VatPeriod, WorkStyle } from '../domain/person'
import type { TimeEntry } from '../domain/timesheet'
import type { VatTreatment } from '../domain/vat'

/** A row as PostgREST returns it. Numeric columns may arrive as strings. */
export type Row = Record<string, unknown>

const num = (v: unknown): number => Number(v ?? 0)
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const optional = (v: unknown): string | undefined => (v === null || v === undefined || v === '' ? undefined : String(v))
const nullable = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))

export function personToRow(p: Person): Row {
  return {
    id: p.id, display_name: p.displayName, role_title: p.roleTitle, work_style: p.workStyle, color: p.color,
    business_name: p.businessName, org_number: p.orgNumber, address: p.address, email: p.email, phone: p.phone,
    vat_registered: p.vatRegistered, vat_number: p.vatNumber, vat_period: p.vatPeriod, accounting_method: p.accountingMethod,
    municipal_rate: p.municipalRate, birth_year: p.birthYear, employment_income: p.employmentIncome,
    monthly_fskatt: p.monthlyFskatt, has_occupational_pension: p.hasOccupationalPension, housing: p.housing,
    bankgiro: p.bankgiro, iban: p.iban, bic: p.bic, invoice_prefix: p.invoicePrefix, next_invoice_number: p.nextInvoiceNumber,
    payment_terms_days: p.paymentTermsDays, hourly_rate: p.hourlyRate, base_fee: p.baseFee,
    commission_percent: p.commissionPercent, default_client_name: p.defaultClientName, default_currency: p.defaultCurrency,
  }
}

export function personFromRow(r: Row): Person {
  return {
    id: str(r.id), displayName: str(r.display_name), roleTitle: str(r.role_title), workStyle: str(r.work_style) as WorkStyle,
    color: str(r.color), businessName: str(r.business_name), orgNumber: str(r.org_number), address: str(r.address),
    email: str(r.email), phone: str(r.phone), vatRegistered: Boolean(r.vat_registered), vatNumber: str(r.vat_number),
    vatPeriod: str(r.vat_period) as VatPeriod, accountingMethod: str(r.accounting_method) as AccountingMethod,
    municipalRate: num(r.municipal_rate), birthYear: num(r.birth_year), employmentIncome: num(r.employment_income),
    monthlyFskatt: num(r.monthly_fskatt), hasOccupationalPension: Boolean(r.has_occupational_pension),
    housing: str(r.housing) as Housing, bankgiro: str(r.bankgiro), iban: str(r.iban), bic: str(r.bic),
    invoicePrefix: str(r.invoice_prefix), nextInvoiceNumber: num(r.next_invoice_number),
    paymentTermsDays: num(r.payment_terms_days), hourlyRate: num(r.hourly_rate), baseFee: num(r.base_fee),
    commissionPercent: num(r.commission_percent), defaultClientName: str(r.default_client_name),
    defaultCurrency: (str(r.default_currency) || 'SEK') as Currency,
  }
}

function lineToRow(l: InvoiceLine) {
  return {
    id: l.id, kind: l.kind, description: l.description, vat_rate: l.vatRate,
    work_date: l.kind === 'time' ? l.workDate : null,
    minutes: l.kind === 'time' ? l.minutes : null,
    hourly_rate: l.kind === 'time' ? l.hourlyRate : null,
    time_entry_id: l.kind === 'time' ? (l.timeEntryId ?? null) : null,
    quantity: l.kind === 'fixed' ? l.quantity : null,
    unit: l.kind === 'fixed' ? l.unit : null,
    unit_price: l.kind === 'fixed' ? l.unitPrice : null,
    sales_base: l.kind === 'commission' ? l.salesBase : null,
    percent: l.kind === 'commission' ? l.percent : null,
  }
}

function lineFromRow(r: Row): InvoiceLine {
  const common = { id: str(r.id), description: str(r.description), vatRate: num(r.vat_rate) }
  switch (r.kind) {
    case 'time': {
      const hourlyRate = r.hourly_rate === null || r.hourly_rate === undefined ? null : num(r.hourly_rate)
      const line: InvoiceLine = { ...common, kind: 'time', workDate: str(r.work_date), minutes: num(r.minutes), hourlyRate }
      const entry = optional(r.time_entry_id)
      return entry ? { ...line, timeEntryId: entry } : line
    }
    case 'commission':
      return { ...common, kind: 'commission', salesBase: num(r.sales_base), percent: num(r.percent) }
    default:
      return { ...common, kind: 'fixed', quantity: num(r.quantity), unit: str(r.unit), unitPrice: num(r.unit_price) }
  }
}

/** Arguments for the `save_invoice` database function. */
export function invoiceToRpc(i: Invoice) {
  return {
    p_invoice: {
      id: i.id, owner_id: i.ownerId, number: i.number, client_id: i.clientId, client_name: i.clientName,
      client_address: i.clientAddress ?? '', client_org_number: i.clientOrgNumber ?? '', client_vat_number: i.clientVatNumber ?? '',
      issue_date: i.issueDate, due_date: i.dueDate, currency: i.currency, fx_rate_to_sek: i.fxRateToSek,
      vat_treatment: i.vatTreatment, status: i.status, paid_date: i.paidDate, paid_amount: i.paidAmount, paid_amount_sek: i.paidAmountSek ?? null,
      credits_invoice_id: i.creditsInvoiceId, notes: i.notes,
    },
    p_lines: i.lines.map(lineToRow),
  }
}

export function invoiceFromRow(r: Row): Invoice {
  const lines = ((r.invoice_lines as Row[] | undefined) ?? [])
    .slice()
    .sort((a, b) => num(a.position) - num(b.position))
    .map(lineFromRow)
  return {
    id: str(r.id), ownerId: str(r.owner_id), number: str(r.number), clientId: nullable(r.client_id),
    clientName: str(r.client_name), clientAddress: optional(r.client_address), clientOrgNumber: optional(r.client_org_number),
    clientVatNumber: optional(r.client_vat_number), issueDate: str(r.issue_date), dueDate: str(r.due_date),
    currency: str(r.currency) as Currency, fxRateToSek: num(r.fx_rate_to_sek), vatTreatment: str(r.vat_treatment) as VatTreatment,
    status: str(r.status) as InvoiceRecordStatus, paidDate: nullable(r.paid_date),
    paidAmount: r.paid_amount === null || r.paid_amount === undefined ? null : num(r.paid_amount),
    paidAmountSek: r.paid_amount_sek === null || r.paid_amount_sek === undefined ? null : num(r.paid_amount_sek),
    creditsInvoiceId: nullable(r.credits_invoice_id), notes: str(r.notes), lines,
  }
}

export function timeEntryToRow(e: TimeEntry): Row {
  return { id: e.id, owner_id: e.ownerId, project_id: e.projectId, work_date: e.workDate, minutes: e.minutes, note: e.note, invoice_id: e.invoiceId }
}

export function timeEntryFromRow(r: Row): TimeEntry {
  return {
    id: str(r.id), ownerId: str(r.owner_id), projectId: nullable(r.project_id), workDate: str(r.work_date),
    minutes: num(r.minutes), note: str(r.note), invoiceId: nullable(r.invoice_id),
  }
}

export function expenseToRow(e: Expense): Row {
  return {
    id: e.id, owner_id: e.ownerId, expense_date: e.date, supplier: e.supplier, category: e.category,
    amount_gross: e.amountGross, vat_amount: e.vatAmount, currency: e.currency, fx_rate_to_sek: e.fxRateToSek,
    deductible_percent: e.deductiblePercent, receipt_path: e.receiptPath, note: e.note,
  }
}

export function expenseFromRow(r: Row): Expense {
  return {
    id: str(r.id), ownerId: str(r.owner_id), date: str(r.expense_date), supplier: str(r.supplier),
    category: str(r.category) as ExpenseCategory, amountGross: num(r.amount_gross), vatAmount: num(r.vat_amount),
    currency: str(r.currency) as Currency, fxRateToSek: num(r.fx_rate_to_sek), deductiblePercent: num(r.deductible_percent),
    receiptPath: nullable(r.receipt_path), note: str(r.note),
  }
}

export function deductionToRow(d: Deduction): Row {
  return { id: d.id, owner_id: d.ownerId, year: d.year, type: d.type, amount: d.amount, distance_mil: d.distanceMil ?? null, note: d.note }
}

export function deductionFromRow(r: Row): Deduction {
  const deduction: Deduction = {
    id: str(r.id), ownerId: str(r.owner_id), year: num(r.year), type: str(r.type) as Deduction['type'], amount: num(r.amount), note: str(r.note),
  }
  return r.distance_mil === null || r.distance_mil === undefined ? deduction : { ...deduction, distanceMil: num(r.distance_mil) }
}
