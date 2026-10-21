import { parseIso, type IsoDate } from './dates'
import { reclaimableVatSek, type Expense } from './expense'
import { invoiceTotals, type Invoice } from './invoice'
import type { AccountingMethod, VatPeriod } from './person'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface VatPeriodRange {
  start: IsoDate
  end: IsoDate
  label: string
  year: number
  /** Month (1–12), quarter (1–4) or 1 for yearly. */
  index: number
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const pad = (n: number) => String(n).padStart(2, '0')

export function vatPeriodRange(period: VatPeriod, date: IsoDate): VatPeriodRange {
  const d = parseIso(date)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  if (period === 'monthly') {
    return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${lastDay(year, month)}`, label: `${MONTHS[month - 1]} ${year}`, year, index: month }
  }
  if (period === 'quarterly') {
    const q = Math.ceil(month / 3)
    const endMonth = q * 3
    return { start: `${year}-${pad(endMonth - 2)}-01`, end: `${year}-${pad(endMonth)}-${lastDay(year, endMonth)}`, label: `Q${q} ${year}`, year, index: q }
  }
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year), year, index: 1 }
}

export interface VatReport {
  /** Whole kronor, rounded down as on the moms return. */
  domesticSales: number
  outputVat: number
  euServiceSales: number
  exportSales: number
  inputVat: number
  toPay: number
}

const kr = (ore: number) => Math.floor(ore / 100)

/** The figures for one moms return. Cash method counts invoices when paid, invoice method when issued. */
export function vatReport(input: {
  invoices: readonly Invoice[]
  expenses: readonly Expense[]
  ownerId: string
  period: VatPeriodRange
  method: AccountingMethod
}): VatReport {
  const { start, end } = input.period
  const inPeriod = (date: IsoDate | null) => date !== null && date >= start && date <= end
  const invoices = input.invoices.filter(
    (i) => i.ownerId === input.ownerId && i.status !== 'draft' && inPeriod(input.method === 'cash' ? i.paidDate : i.issueDate),
  )

  let domestic = 0
  let output = 0
  let eu = 0
  let exported = 0
  for (const invoice of invoices) {
    const t = invoiceTotals(invoice)
    if (invoice.vatTreatment === 'domestic') {
      domestic += t.netSek.amount
      output += t.vatSek.amount
    } else if (invoice.vatTreatment === 'eu_reverse_charge') eu += t.netSek.amount
    else if (invoice.vatTreatment === 'export') exported += t.netSek.amount
  }

  const input_ = input.expenses
    .filter((e) => e.ownerId === input.ownerId && inPeriod(e.date))
    .reduce((sum, e) => sum + reclaimableVatSek(e, true).amount, 0)

  const outputVat = kr(output)
  const inputVat = kr(input_)
  return { domesticSales: kr(domestic), outputVat, euServiceSales: kr(eu), exportSales: kr(exported), inputVat, toPay: outputVat - inputVat }
}
