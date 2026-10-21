import { addDays, monthKey, yearOf, type IsoDate } from './dates'
import { invoiceStatus, invoiceTotals, receivedSek, type Invoice, type InvoiceStatus } from './invoice'
import { convertToSek, money, sumMoney, type Money } from './money'

/** Invoices that represent money owed: sent (or part paid / paid), not drafts or cancelled ones. */
function isLive(invoice: Invoice): boolean {
  return invoice.status === 'sent'
}

function outstanding(invoice: Invoice): number {
  const gross = invoiceTotals(invoice).gross.amount
  if (!invoice.paidDate) return gross
  return invoice.paidAmount === null ? 0 : Math.max(0, gross - invoice.paidAmount)
}

const toSek = (amountMinor: number, invoice: Invoice): Money =>
  convertToSek(money(amountMinor, invoice.currency), invoice.fxRateToSek)

export interface DashboardKpis {
  expected30: Money
  overdue: Money
  paidThisMonth: Money
  overdueCount: number
  dueSoonCount: number
}

export function dashboardKpis(invoices: readonly Invoice[], today: IsoDate, ownerId?: string): DashboardKpis {
  const live = invoices.filter((i) => isLive(i) && (!ownerId || i.ownerId === ownerId))
  const horizon = addDays(today, 30)
  const thisMonth = monthKey(today)
  const open = live.filter((i) => outstanding(i) > 0)
  const overdue = open.filter((i) => i.dueDate < today)
  const expected = open.filter((i) => i.dueDate >= today && i.dueDate <= horizon)
  const paid = live.filter((i) => i.paidDate && monthKey(i.paidDate) === thisMonth)
  return {
    expected30: sumMoney(expected.map((i) => toSek(outstanding(i), i)), 'SEK'),
    overdue: sumMoney(overdue.map((i) => toSek(outstanding(i), i)), 'SEK'),
    paidThisMonth: sumMoney(paid.map(receivedSek), 'SEK'),
    overdueCount: overdue.length,
    dueSoonCount: open.filter((i) => invoiceStatus(i, today) === 'due_soon').length,
  }
}

export interface PaymentRow {
  invoice: Invoice
  status: InvoiceStatus
  grossSek: Money
  outstandingSek: Money
}

export function incomingPayments(invoices: readonly Invoice[], today: IsoDate, ownerId?: string): PaymentRow[] {
  const rows = invoices
    .filter((i) => isLive(i) && (!ownerId || i.ownerId === ownerId))
    .map((invoice) => ({
      invoice,
      status: invoiceStatus(invoice, today),
      grossSek: invoiceTotals(invoice).grossSek,
      outstandingSek: toSek(outstanding(invoice), invoice),
    }))
  const open = rows.filter((r) => r.outstandingSek.amount > 0).sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate))
  const settled = rows
    .filter((r) => r.outstandingSek.amount <= 0)
    .sort((a, b) => (b.invoice.paidDate ?? '').localeCompare(a.invoice.paidDate ?? ''))
  return [...open, ...settled]
}

export interface MonthCash {
  month: string
  /** Öre in SEK per owner. */
  paid: Record<string, number>
  expected: Record<string, number>
}

export function cashInByMonth(invoices: readonly Invoice[], months: readonly string[]): MonthCash[] {
  const result = months.map((month) => ({ month, paid: {} as Record<string, number>, expected: {} as Record<string, number> }))
  const byMonth = new Map(result.map((m) => [m.month, m]))
  const add = (bucket: Record<string, number>, owner: string, amount: number) => {
    if (amount > 0) bucket[owner] = (bucket[owner] ?? 0) + amount
  }
  for (const invoice of invoices.filter(isLive)) {
    if (invoice.paidDate) {
      const m = byMonth.get(monthKey(invoice.paidDate))
      if (m) add(m.paid, invoice.ownerId, receivedSek(invoice).amount)
    }
    const rest = outstanding(invoice)
    if (rest > 0) {
      const m = byMonth.get(monthKey(invoice.dueDate))
      if (m) add(m.expected, invoice.ownerId, toSek(rest, invoice).amount)
    }
  }
  return result
}

/** Net sales (excluding VAT) invoiced in a year, whole kronor in SEK. Credit notes count negative. */
export function turnoverForYear(invoices: readonly Invoice[], ownerId: string, year: number): number {
  const counted = invoices.filter((i) => i.ownerId === ownerId && i.status !== 'draft' && yearOf(i.issueDate) === year)
  return Math.round(sumMoney(counted.map((i) => invoiceTotals(i).netSek), 'SEK').amount / 100)
}

export function vatThresholdStatus(turnover: number, threshold: number): { level: 'ok' | 'approaching' | 'exceeded'; share: number } {
  const share = threshold > 0 ? turnover / threshold : 0
  return { level: share >= 1 ? 'exceeded' : share >= 0.75 ? 'approaching' : 'ok', share }
}
