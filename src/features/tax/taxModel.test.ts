import { describe, expect, it } from 'vitest'
import { yearToDate, personTaxSummary, fSkattPaidSoFar } from './taxModel'
import type { Invoice } from '../../domain/invoice'
import type { Person } from '../../domain/person'
import type { Expense, Deduction } from '../../domain/expense'
import { demoSeed } from '../../data/demoSeed'
import { FIXTURE_PARAMS } from '../../domain/tax/fixtures'

const alex: Person = demoSeed('2026-10-21').people[0]
const inv = (over: Partial<Invoice>): Invoice => ({
  id: crypto.randomUUID(), ownerId: 'alex', number: 'A-1', clientId: null, clientName: 'C', issueDate: '2026-03-01', dueDate: '2026-03-31',
  currency: 'SEK', fxRateToSek: 1, vatTreatment: 'domestic', status: 'sent', paidDate: '2026-03-31', paidAmount: null,
  creditsInvoiceId: null, notes: '',
  lines: [{ id: 'l', kind: 'fixed', description: 'Work', quantity: 1, unit: 'st', unitPrice: 10_000_000, vatRate: 25 }],
  ...over,
})
const invoices = [
  inv({}),
  inv({ issueDate: '2026-10-01', dueDate: '2026-10-31', paidDate: null }),
  inv({ paidDate: '2025-12-30', issueDate: '2025-12-01' }),
  inv({ ownerId: 'sam' }),
  inv({ status: 'draft', paidDate: null }),
]
const expenses: Expense[] = [
  { id: 'e', ownerId: 'alex', date: '2026-02-01', supplier: 'S', category: 'software', amountGross: 1_250_000, vatAmount: 250_000, currency: 'SEK', fxRateToSek: 1, deductiblePercent: 100, receiptPath: null, note: '' },
]
const deductions: Deduction[] = [
  { id: 'd1', ownerId: 'alex', year: 2026, type: 'home_office', amount: 4_000, note: '' },
  { id: 'd2', ownerId: 'alex', year: 2026, type: 'mileage', amount: 1_500, distanceMil: 60, note: '' },
  { id: 'd3', ownerId: 'alex', year: 2025, type: 'mileage', amount: 9_999, note: '' },
]

describe('yearToDate', () => {
  it('counts paid invoices excluding VAT under the cash method', () => {
    const ytd = yearToDate({ person: alex, invoices, expenses, deductions, today: '2026-10-21' })
    expect(ytd.income).toBe(100_000)
    expect(ytd.expenses).toBe(10_000)
    expect(ytd.homeOffice).toBe(4_000)
    expect(ytd.mileage).toBe(1_500)
  })

  it('counts issued invoices under the invoice method', () => {
    const ytd = yearToDate({ person: { ...alex, accountingMethod: 'invoice' }, invoices, expenses, deductions, today: '2026-10-21' })
    expect(ytd.income).toBe(200_000)
  })
})

describe('personTaxSummary', () => {
  it('projects income and expenses to the full year but keeps annual deductions as they are', () => {
    const s = personTaxSummary({ person: alex, invoices, expenses, deductions, params: FIXTURE_PARAMS, today: '2026-07-02', plan: { periodiseringsfond: 0, pensionSaving: 0 } })
    expect(s.input.businessIncome).toBe(Math.round(100_000 / (183 / 365)))
    expect(s.input.homeOffice).toBe(4_000)
    expect(s.estimate.total).toBeGreaterThan(0)
  })

  it('compares the estimate with the F-skatt plan', () => {
    const s = personTaxSummary({ person: { ...alex, monthlyFskatt: 0 }, invoices, expenses, deductions, params: FIXTURE_PARAMS, today: '2026-10-21', plan: { periodiseringsfond: 0, pensionSaving: 0 } })
    expect(s.advice.shortfall).toBe(s.estimate.total)
  })
})

describe('fSkattPaidSoFar', () => {
  it('counts the instalments whose due date has passed', () => {
    expect(fSkattPaidSoFar(10_000, '2026-10-21')).toBe(100_000)
    expect(fSkattPaidSoFar(10_000, '2026-01-10')).toBe(0)
  })
})
