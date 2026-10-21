import { describe, expect, it } from 'vitest'
import { dashboardKpis, incomingPayments, cashInByMonth, turnoverForYear, vatThresholdStatus } from './dashboard'
import type { Invoice } from './invoice'
import { money } from './money'

let n = 0
function inv(over: Partial<Invoice>): Invoice {
  n += 1
  return {
    id: `i${n}`, ownerId: 'alex', number: `A-${n}`, clientId: null, clientName: 'Client', issueDate: '2026-10-01',
    dueDate: '2026-10-31', currency: 'SEK', fxRateToSek: 1, vatTreatment: 'exempt', status: 'sent', paidDate: null,
    paidAmount: null, creditsInvoiceId: null, notes: '',
    lines: [{ id: 'l', kind: 'fixed', description: 'Work', quantity: 1, unit: 'st', unitPrice: 1_000_000, vatRate: 0 }],
    ...over,
  }
}

const today = '2026-10-21'
const invoices = [
  inv({ id: 'overdue', dueDate: '2026-10-15' }),
  inv({ id: 'soon', dueDate: '2026-10-25', ownerId: 'sam' }),
  inv({ id: 'later', dueDate: '2026-11-15' }),
  inv({ id: 'far', dueDate: '2026-12-31' }),
  inv({ id: 'paid', dueDate: '2026-10-08', paidDate: '2026-10-08', paidAmount: 1_000_000 }),
  inv({ id: 'paid-sept', dueDate: '2026-09-20', paidDate: '2026-09-20', paidAmount: 1_000_000 }),
  inv({ id: 'eur', dueDate: '2026-11-05', currency: 'EUR', fxRateToSek: 11.5, lines: [{ id: 'l', kind: 'fixed', description: 'x', quantity: 1, unit: 'st', unitPrice: 100_000, vatRate: 0 }] }),
  inv({ id: 'draft', status: 'draft', dueDate: '2026-10-25' }),
  inv({ id: 'part', dueDate: '2026-10-30', paidDate: '2026-10-20', paidAmount: 400_000 }),
]

describe('dashboardKpis', () => {
  it('sums expected (next 30 days), overdue and paid this month in SEK', () => {
    const k = dashboardKpis(invoices, today)
    // soon 10 000 + later 10 000 + eur 11 500 + part remainder 6 000
    expect(k.expected30).toEqual(money(3_750_000, 'SEK'))
    expect(k.overdue).toEqual(money(1_000_000, 'SEK'))
    // paid 10 000 + part payment 4 000
    expect(k.paidThisMonth).toEqual(money(1_400_000, 'SEK'))
    expect(k.overdueCount).toBe(1)
  })

  it('can be filtered to one person', () => {
    expect(dashboardKpis(invoices, today, 'sam').expected30).toEqual(money(1_000_000, 'SEK'))
  })
})

describe('incomingPayments', () => {
  it('lists unpaid by due date first, then paid newest first, without drafts', () => {
    expect(incomingPayments(invoices, today).map((r) => r.invoice.id)).toEqual([
      'overdue', 'soon', 'part', 'eur', 'later', 'far', 'paid', 'paid-sept',
    ])
  })

  it('shows the outstanding amount in SEK and the status', () => {
    const part = incomingPayments(invoices, today).find((r) => r.invoice.id === 'part')!
    expect(part.outstandingSek).toEqual(money(600_000, 'SEK'))
    expect(part.status).toBe('part_paid')
  })
})

describe('cashInByMonth', () => {
  it('splits paid and expected money per month and person', () => {
    const months = cashInByMonth(invoices, ['2026-09', '2026-10', '2026-11'])
    expect(months[0]).toEqual({ month: '2026-09', paid: { alex: 1_000_000 }, expected: {} })
    expect(months[1].paid).toEqual({ alex: 1_400_000 })
    expect(months[1].expected).toEqual({ alex: 1_600_000, sam: 1_000_000 })
    expect(months[2].expected).toEqual({ alex: 2_150_000 })
  })
})

describe('VAT threshold', () => {
  it('counts the year turnover excluding drafts, net of VAT, in whole kronor', () => {
    expect(turnoverForYear(invoices, 'alex', 2026)).toBe(71_500)
  })

  it('flags approaching from 75% and exceeded at the limit', () => {
    expect(vatThresholdStatus(50_000, 120_000).level).toBe('ok')
    expect(vatThresholdStatus(90_000, 120_000).level).toBe('approaching')
    expect(vatThresholdStatus(120_000, 120_000).level).toBe('exceeded')
  })
})

describe('foreign invoices paid in SEK', () => {
  it('counts the SEK that actually arrived as paid this month', () => {
    const usd = inv({
      id: 'usd', ownerId: 'sam', currency: 'USD', fxRateToSek: 10, dueDate: '2026-10-20', paidDate: '2026-10-21', paidAmount: 100_000, paidAmountSek: 1_032_500,
      lines: [{ id: 'l', kind: 'fixed', description: 'Base', quantity: 1, unit: 'st', unitPrice: 100_000, vatRate: 0 }],
    })
    expect(dashboardKpis([usd], today).paidThisMonth).toEqual(money(1_032_500, 'SEK'))
    expect(cashInByMonth([usd], ['2026-10'])[0].paid).toEqual({ sam: 1_032_500 })
  })
})

describe('VAT limit turnover for sales outside Sweden', () => {
  it('leaves out invoices whose place of supply is outside Sweden', () => {
    const sales = [
      inv({ id: 'se', ownerId: 'sam', vatTreatment: 'exempt' }),
      inv({ id: 'us', ownerId: 'sam', vatTreatment: 'export', currency: 'USD', fxRateToSek: 10 }),
    ]
    expect(turnoverForYear(sales, 'sam', 2026)).toBe(10_000)
  })
})
