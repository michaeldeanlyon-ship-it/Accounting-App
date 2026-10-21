import { addDays, nextWeekday, yearOf, type IsoDate } from './dates'
import type { VatPeriod } from './person'
import { fSkattDueDay } from './tax/estimate'

export type DeadlineKind = 'f_skatt' | 'moms' | 'eu_sales_list' | 'income_tax_return' | 'year_end'

export interface Deadline {
  date: IsoDate
  kind: DeadlineKind
  label: string
  /** Missing for deadlines that apply to both people. */
  ownerId?: string
}

const KIND_ORDER: DeadlineKind[] = ['f_skatt', 'moms', 'eu_sales_list', 'income_tax_return', 'year_end']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function iso(year: number, month: number, day: number): IsoDate {
  // Month may overflow into the next year (13 = January next year).
  const y = year + Math.floor((month - 1) / 12)
  const m = ((month - 1) % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Due day in a month where the 17th rule applies in January and August. */
function dueInMonth(year: number, month: number): IsoDate {
  const m = ((month - 1) % 12) + 1
  return nextWeekday(iso(year, month, m === 1 || m === 8 ? 17 : 12))
}

/**
 * Moms return due date for businesses with turnover up to 40 MSEK.
 * `index` is the month (1–12) for monthly, the quarter (1–4) for quarterly, ignored for yearly.
 */
export function momsDueDate(period: VatPeriod, year: number, index: number, hasEuTrade: boolean): IsoDate {
  switch (period) {
    case 'monthly':
      return dueInMonth(year, index + 2)
    case 'quarterly':
      return dueInMonth(year, index * 3 + 2)
    case 'yearly':
      return nextWeekday(hasEuTrade ? iso(year + 1, 2, 26) : iso(year + 1, 5, 12))
  }
}

/** Periodisk sammanställning for EU service sales, filed electronically by the 25th after the quarter. */
export function euSalesListDueDate(year: number, quarter: number): IsoDate {
  return nextWeekday(iso(year, quarter * 3 + 1, 25))
}

export function fSkattDates(year: number): IsoDate[] {
  return Array.from({ length: 12 }, (_, i) => nextWeekday(iso(year, i + 1, fSkattDueDay(i + 1))))
}

export interface DeadlinePerson {
  id: string
  name: string
  vatRegistered: boolean
  vatPeriod: VatPeriod
  hasEuSales: boolean
}

function momsLabel(period: VatPeriod, year: number, index: number): string {
  if (period === 'monthly') return `Moms return ${MONTHS[index - 1]}`
  if (period === 'quarterly') return `Moms return Q${index} (${MONTHS[index * 3 - 3]}–${MONTHS[index * 3 - 1]})`
  return `Moms return ${year}`
}

export function upcomingDeadlines(input: { today: IsoDate; people: DeadlinePerson[]; horizonDays: number }): Deadline[] {
  const { today } = input
  const until = addDays(today, input.horizonDays)
  const year = yearOf(today)
  const years = [year - 1, year, year + 1]
  const all: Deadline[] = []

  for (const y of years) {
    for (const date of fSkattDates(y)) all.push({ date, kind: 'f_skatt', label: 'F-skatt instalment' })
    all.push({ date: `${y}-12-31`, kind: 'year_end', label: 'Year end: last day for deductible purchases' })
    all.push({ date: nextWeekday(iso(y, 5, 2)), kind: 'income_tax_return', label: `Income tax return with NE-bilaga for ${y - 1}` })

    for (const p of input.people) {
      if (p.vatRegistered) {
        const count = p.vatPeriod === 'monthly' ? 12 : p.vatPeriod === 'quarterly' ? 4 : 1
        for (let i = 1; i <= count; i++) {
          all.push({ date: momsDueDate(p.vatPeriod, y, i, p.hasEuSales), kind: 'moms', label: momsLabel(p.vatPeriod, y, i), ownerId: p.id })
        }
      }
      if (p.hasEuSales) {
        for (let q = 1; q <= 4; q++) {
          all.push({ date: euSalesListDueDate(y, q), kind: 'eu_sales_list', label: `EU sales list (periodisk sammanställning) Q${q}`, ownerId: p.id })
        }
      }
    }
  }

  return all
    .filter((d) => d.date >= today && d.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}
