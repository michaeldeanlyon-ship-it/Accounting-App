import { addDays, daysBetween, formatDayLabel, parseIso, type IsoDate } from './dates'
import { amountForMinutes, formatDuration } from './duration'
import {
  addMoney, convertToSek, formatMoney, money, multiplyMoney, percentOf, sumMoney, type Currency, type Money,
} from './money'
import type { TimeEntry } from './timesheet'
import { effectiveVatRate, type VatTreatment } from './vat'

interface LineBase {
  id: string
  description: string
  /** Line VAT rate in percent (25, 12, 6 or 0). Only charged when the invoice is domestic. */
  vatRate: number
}

/** Work logged per day, priced by the hour. Amounts are minor units of the invoice currency. */
export interface TimeLine extends LineBase {
  kind: 'time'
  workDate: IsoDate
  minutes: number
  hourlyRate: number
  timeEntryId?: string
}

export interface FixedLine extends LineBase {
  kind: 'fixed'
  quantity: number
  unit: string
  unitPrice: number
}

/** Commission as a percentage of a sales base, both editable each period. */
export interface CommissionLine extends LineBase {
  kind: 'commission'
  salesBase: number
  percent: number
}

export type InvoiceLine = TimeLine | FixedLine | CommissionLine

export type InvoiceRecordStatus = 'draft' | 'sent' | 'credited'

export interface Invoice {
  id: string
  ownerId: string
  number: string
  clientId: string | null
  clientName: string
  clientAddress?: string
  clientOrgNumber?: string
  clientVatNumber?: string
  issueDate: IsoDate
  dueDate: IsoDate
  currency: Currency
  fxRateToSek: number
  vatTreatment: VatTreatment
  status: InvoiceRecordStatus
  paidDate: IsoDate | null
  /** Minor units of the invoice currency. Null with a paid date means paid in full. */
  paidAmount: number | null
  creditsInvoiceId: string | null
  notes: string
  lines: InvoiceLine[]
}

export type InvoiceStatus = 'draft' | 'sent' | 'due_soon' | 'overdue' | 'part_paid' | 'paid' | 'credited'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  part_paid: 'Part paid',
  paid: 'Paid',
  credited: 'Credited',
}

export const DUE_SOON_DAYS = 7

export function lineNet(line: InvoiceLine, currency: Currency): Money {
  switch (line.kind) {
    case 'time':
      return amountForMinutes(line.minutes, money(line.hourlyRate, currency))
    case 'fixed':
      return multiplyMoney(money(line.unitPrice, currency), line.quantity)
    case 'commission':
      return percentOf(money(line.salesBase, currency), line.percent)
  }
}

export function lineDetail(line: InvoiceLine, currency: Currency): string {
  switch (line.kind) {
    case 'time':
      return `${formatDuration(line.minutes)} × ${formatMoney(money(line.hourlyRate, currency))}/h`
    case 'fixed':
      return `${line.quantity} ${line.unit} × ${formatMoney(money(line.unitPrice, currency))}`
    case 'commission':
      return `${line.percent}% of ${formatMoney(money(line.salesBase, currency))}`
  }
}

export interface VatGroup {
  rate: number
  net: Money
  vat: Money
}

export interface InvoiceTotals {
  net: Money
  vatGroups: VatGroup[]
  vat: Money
  gross: Money
  grossSek: Money
  netSek: Money
  vatSek: Money
  totalMinutes: number
}

export function invoiceTotals(invoice: Invoice): InvoiceTotals {
  const { currency } = invoice
  const nets = invoice.lines.map((line) => ({ line, net: lineNet(line, currency) }))
  const net = sumMoney(nets.map((n) => n.net), currency)

  const byRate = new Map<number, Money>()
  for (const { line, net: lineAmount } of nets) {
    const rate = effectiveVatRate(invoice.vatTreatment, line.vatRate)
    if (rate === 0) continue
    byRate.set(rate, addMoney(byRate.get(rate) ?? money(0, currency), lineAmount))
  }
  const vatGroups = [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, groupNet]) => ({ rate, net: groupNet, vat: percentOf(groupNet, rate) }))
  const vat = sumMoney(vatGroups.map((g) => g.vat), currency)
  const gross = addMoney(net, vat)

  const totalMinutes = invoice.lines.reduce((sum, l) => sum + (l.kind === 'time' ? l.minutes : 0), 0)
  return {
    net,
    vatGroups,
    vat,
    gross,
    netSek: convertToSek(net, invoice.fxRateToSek),
    vatSek: convertToSek(vat, invoice.fxRateToSek),
    grossSek: convertToSek(gross, invoice.fxRateToSek),
    totalMinutes,
  }
}

export function isPaidInFull(invoice: Invoice): boolean {
  if (!invoice.paidDate) return false
  return invoice.paidAmount === null || invoice.paidAmount >= invoiceTotals(invoice).gross.amount
}

export function invoiceStatus(invoice: Invoice, today: IsoDate): InvoiceStatus {
  if (invoice.status === 'credited') return 'credited'
  if (invoice.status === 'draft') return 'draft'
  if (invoice.paidDate) return isPaidInFull(invoice) ? 'paid' : 'part_paid'
  const daysLeft = daysBetween(today, invoice.dueDate)
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= DUE_SOON_DAYS) return 'due_soon'
  return 'sent'
}

export function recordPayment(invoice: Invoice, date: IsoDate, amount?: number): Invoice {
  return { ...invoice, paidDate: date, paidAmount: amount ?? invoiceTotals(invoice).gross.amount }
}

export function markUnpaid(invoice: Invoice): Invoice {
  return { ...invoice, paidDate: null, paidAmount: null }
}

export function dueDateFromTerms(issueDate: IsoDate, termsDays: number): IsoDate {
  return addDays(issueDate, termsDays)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The half-month a sales invoice covers: 1–15 or 16–end of month. */
export function salesPeriodFor(date: IsoDate): { start: IsoDate; end: IsoDate; label: string } {
  const d = parseIso(date)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const ym = `${y}-${String(m + 1).padStart(2, '0')}`
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const month = MONTHS[m]
  return d.getUTCDate() <= 15
    ? { start: `${ym}-01`, end: `${ym}-15`, label: `1–15 ${month}` }
    : { start: `${ym}-16`, end: `${ym}-${lastDay}`, label: `16–${lastDay} ${month}` }
}

export function salesInvoiceLines(input: {
  baseFee: number
  periodLabel: string
  commissionPercent: number
  vatRate: number
}): InvoiceLine[] {
  return [
    {
      id: crypto.randomUUID(), kind: 'fixed', description: `Base fee ${input.periodLabel}`,
      quantity: 1, unit: 'st', unitPrice: input.baseFee, vatRate: input.vatRate,
    },
    {
      id: crypto.randomUUID(), kind: 'commission', description: `Commission ${input.periodLabel}`,
      salesBase: 0, percent: input.commissionPercent, vatRate: input.vatRate,
    },
  ]
}

export function timeLinesFromEntries(entries: readonly TimeEntry[], hourlyRate: number, vatRate: number): TimeLine[] {
  return [...entries]
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((entry) => ({
      id: crypto.randomUUID(),
      kind: 'time',
      description: `${formatDayLabel(entry.workDate)} · ${entry.note}`,
      workDate: entry.workDate,
      minutes: entry.minutes,
      hourlyRate,
      vatRate,
      timeEntryId: entry.id,
    }))
}

function negateLine(line: InvoiceLine): InvoiceLine {
  const id = crypto.randomUUID()
  switch (line.kind) {
    case 'time':
      return { ...line, id, minutes: -line.minutes, timeEntryId: undefined }
    case 'fixed':
      return { ...line, id, quantity: -line.quantity }
    case 'commission':
      return { ...line, id, salesBase: -line.salesBase }
  }
}

/** A kreditfaktura that cancels the original in full. */
export function createCreditNote(original: Invoice, input: { id: string; number: string; issueDate: IsoDate }): Invoice {
  return {
    ...original,
    id: input.id,
    number: input.number,
    issueDate: input.issueDate,
    dueDate: input.issueDate,
    status: 'draft',
    paidDate: null,
    paidAmount: null,
    creditsInvoiceId: original.id,
    notes: `Credit note for invoice ${original.number}`,
    lines: original.lines.map(negateLine),
  }
}

export function validateForSending(invoice: Invoice): string[] {
  const errors: string[] = []
  if (!invoice.clientName.trim()) errors.push('Add the client name')
  if (invoice.lines.length === 0) errors.push('Add at least one line')
  if (daysBetween(invoice.issueDate, invoice.dueDate) < 0) errors.push('Due date must be on or after the issue date')
  return errors
}
