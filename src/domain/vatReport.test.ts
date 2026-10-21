import { describe, expect, it } from 'vitest'
import { vatPeriodRange, vatReport } from './vatReport'
import type { Invoice } from './invoice'
import type { Expense } from './expense'

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'i', ownerId: 'alex', number: 'A-1', clientId: null, clientName: 'C', issueDate: '2026-09-25', dueDate: '2026-10-25',
  currency: 'SEK', fxRateToSek: 1, vatTreatment: 'domestic', status: 'sent', paidDate: '2026-10-05', paidAmount: null,
  creditsInvoiceId: null, notes: '',
  lines: [{ id: 'l', kind: 'fixed', description: 'Work', quantity: 1, unit: 'st', unitPrice: 1_000_000, vatRate: 25 }],
  ...over,
})
const expense = (over: Partial<Expense>): Expense => ({
  id: 'e', ownerId: 'alex', date: '2026-10-02', supplier: 'Adobe', category: 'software', amountGross: 125_000, vatAmount: 25_000,
  currency: 'SEK', fxRateToSek: 1, deductiblePercent: 100, receiptPath: null, note: '', ...over,
})

describe('vat periods', () => {
  it('finds the period containing a date', () => {
    expect(vatPeriodRange('quarterly', '2026-10-21')).toEqual({ start: '2026-10-01', end: '2026-12-31', label: 'Q4 2026', year: 2026, index: 4 })
    expect(vatPeriodRange('monthly', '2026-10-21').label).toBe('Oct 2026')
    expect(vatPeriodRange('yearly', '2026-10-21').label).toBe('2026')
  })
})

describe('vatReport', () => {
  const period = vatPeriodRange('quarterly', '2026-10-21')
  const invoices = [
    invoice({ id: 'paid-in-q4' }),
    invoice({ id: 'unpaid', paidDate: null, issueDate: '2026-10-10' }),
    invoice({ id: 'eu', vatTreatment: 'eu_reverse_charge', paidDate: '2026-11-01', currency: 'EUR', fxRateToSek: 11.5,
      lines: [{ id: 'l', kind: 'fixed', description: 'x', quantity: 1, unit: 'st', unitPrice: 100_000, vatRate: 25 }] }),
    invoice({ id: 'other-person', ownerId: 'sam' }),
  ]
  const expenses = [expense({}), expense({ id: 'q3', date: '2026-09-01' })]

  it('uses payment dates under the cash method (kontantmetoden)', () => {
    const r = vatReport({ invoices, expenses, ownerId: 'alex', period, method: 'cash' })
    expect(r.outputVat).toBe(2_500)
    expect(r.domesticSales).toBe(10_000)
    expect(r.euServiceSales).toBe(11_500)
    expect(r.inputVat).toBe(250)
    expect(r.toPay).toBe(2_250)
  })

  it('uses invoice dates under the invoice method (faktureringsmetoden)', () => {
    const r = vatReport({ invoices, expenses, ownerId: 'alex', period, method: 'invoice' })
    expect(r.outputVat).toBe(2_500)
    expect(r.domesticSales).toBe(10_000)
  })
})
