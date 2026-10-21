import { describe, expect, it } from 'vitest'
import {
  lineNet, lineDetail, invoiceTotals, invoiceStatus, dueDateFromTerms, createCreditNote,
  salesPeriodFor, salesInvoiceLines, timeLinesFromEntries, recordPayment, markUnpaid, validateForSending,
  type Invoice, type InvoiceLine,
} from './invoice'
import { money } from './money'

const timeLine = (minutes: number, rate = 65000): InvoiceLine => ({
  id: crypto.randomUUID(), kind: 'time', description: 'Wed 14 Oct · Contract EN→SV', workDate: '2026-10-14', minutes, hourlyRate: rate, vatRate: 25,
})

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1', ownerId: 'alex', number: 'A-0045', clientId: null, clientName: 'Nordic Lingua AB',
    issueDate: '2026-10-20', dueDate: '2026-11-19', currency: 'SEK', fxRateToSek: 1, vatTreatment: 'domestic',
    status: 'sent', paidDate: null, paidAmount: null, creditsInvoiceId: null, notes: '', lines: [timeLine(390)],
    ...overrides,
  }
}

describe('invoice lines', () => {
  it('prices a time line from minutes and hourly rate', () => {
    expect(lineNet(timeLine(390), 'SEK')).toEqual(money(422500, 'SEK'))
  })

  it('prices a fixed line as quantity × unit price', () => {
    expect(lineNet({ id: 'x', kind: 'fixed', description: 'Base fee', quantity: 1, unit: 'st', unitPrice: 1000000, vatRate: 0 }, 'SEK'))
      .toEqual(money(1000000, 'SEK'))
    expect(lineNet({ id: 'x', kind: 'fixed', description: 'Words', quantity: 2.5, unit: 'h', unitPrice: 333, vatRate: 0 }, 'SEK'))
      .toEqual(money(833, 'SEK'))
  })

  it('prices a commission line as a percentage of the sales base', () => {
    expect(lineNet({ id: 'x', kind: 'commission', description: 'Commission', salesBase: 4500000, percent: 5, vatRate: 0 }, 'SEK'))
      .toEqual(money(225000, 'SEK'))
  })

  it('describes each line the way it is printed on the invoice', () => {
    expect(lineDetail(timeLine(435), 'SEK')).toBe('7 h 15 min × 650,00 kr/h')
    expect(lineDetail({ id: 'x', kind: 'commission', description: 'C', salesBase: 4500000, percent: 5, vatRate: 0 }, 'SEK')).toBe('5% of 45 000,00 kr')
    expect(lineDetail({ id: 'x', kind: 'fixed', description: 'F', quantity: 1, unit: 'st', unitPrice: 240000, vatRate: 0 }, 'EUR')).toBe('1 st × €2,400.00')
  })
})

describe('invoice totals', () => {
  it('adds 25% moms on a domestic invoice and totals the time', () => {
    const t = invoiceTotals(invoice({ lines: [timeLine(390), timeLine(435)] }))
    expect(t.net).toEqual(money(893750, 'SEK'))
    expect(t.vat).toEqual(money(223438, 'SEK'))
    expect(t.gross).toEqual(money(1117188, 'SEK'))
    expect(t.totalMinutes).toBe(825)
  })

  it('groups VAT per rate and rounds once per rate', () => {
    const t = invoiceTotals(invoice({
      lines: [
        { id: 'a', kind: 'fixed', description: 'Book', quantity: 1, unit: 'st', unitPrice: 10001, vatRate: 6 },
        { id: 'b', kind: 'fixed', description: 'Book', quantity: 1, unit: 'st', unitPrice: 10001, vatRate: 6 },
        { id: 'c', kind: 'fixed', description: 'Work', quantity: 1, unit: 'st', unitPrice: 10000, vatRate: 25 },
      ],
    }))
    expect(t.vatGroups).toEqual([
      { rate: 25, net: money(10000, 'SEK'), vat: money(2500, 'SEK') },
      { rate: 6, net: money(20002, 'SEK'), vat: money(1200, 'SEK') },
    ])
  })

  it('charges no VAT on a reverse charge invoice and converts to SEK', () => {
    const t = invoiceTotals(invoice({
      currency: 'EUR', fxRateToSek: 11.5, vatTreatment: 'eu_reverse_charge',
      lines: [{ id: 'x', kind: 'fixed', description: 'Manual', quantity: 1, unit: 'st', unitPrice: 240000, vatRate: 25 }],
    }))
    expect(t.vat).toEqual(money(0, 'EUR'))
    expect(t.gross).toEqual(money(240000, 'EUR'))
    expect(t.grossSek).toEqual(money(2760000, 'SEK'))
    expect(t.vatGroups).toEqual([])
  })

  it('shows the VAT in SEK on a foreign-currency invoice with Swedish moms', () => {
    const t = invoiceTotals(invoice({
      currency: 'EUR', fxRateToSek: 11.5,
      lines: [{ id: 'x', kind: 'fixed', description: 'Course', quantity: 1, unit: 'st', unitPrice: 100000, vatRate: 25 }],
    }))
    expect(t.vat).toEqual(money(25000, 'EUR'))
    expect(t.vatSek).toEqual(money(287500, 'SEK'))
  })
})

describe('invoice status', () => {
  const today = '2026-10-20'
  it('is draft until sent', () => expect(invoiceStatus(invoice({ status: 'draft' }), today)).toBe('draft'))
  it('is sent when due more than 7 days away', () => expect(invoiceStatus(invoice({ dueDate: '2026-11-19' }), today)).toBe('sent'))
  it('is due soon within 7 days', () => expect(invoiceStatus(invoice({ dueDate: '2026-10-27' }), today)).toBe('due_soon'))
  it('is overdue after the due date', () => expect(invoiceStatus(invoice({ dueDate: '2026-10-19' }), today)).toBe('overdue'))
  it('is paid when the full amount is received', () =>
    expect(invoiceStatus(recordPayment(invoice({ dueDate: '2026-10-01' }), '2026-10-05'), today)).toBe('paid'))
  it('is part paid when less than the total is received', () =>
    expect(invoiceStatus(recordPayment(invoice(), '2026-10-05', 1000), today)).toBe('part_paid'))
  it('is credited when a credit note cancels it', () => expect(invoiceStatus(invoice({ status: 'credited' }), today)).toBe('credited'))
})

describe('payments', () => {
  it('records the full gross amount by default and can be undone', () => {
    const paid = recordPayment(invoice(), '2026-10-21')
    expect(paid.paidDate).toBe('2026-10-21')
    expect(paid.paidAmount).toBe(invoiceTotals(invoice()).gross.amount)
    const undone = markUnpaid(paid)
    expect(undone.paidDate).toBeNull()
    expect(undone.paidAmount).toBeNull()
  })
})

describe('dates and periods', () => {
  it('calculates the due date from payment terms', () => {
    expect(dueDateFromTerms('2026-10-20', 30)).toBe('2026-11-19')
  })

  it('splits the month into two halves for the twice-monthly sales invoice', () => {
    expect(salesPeriodFor('2026-10-10')).toEqual({ start: '2026-10-01', end: '2026-10-15', label: '1–15 Oct' })
    expect(salesPeriodFor('2026-10-20')).toEqual({ start: '2026-10-16', end: '2026-10-31', label: '16–31 Oct' })
    expect(salesPeriodFor('2026-02-20').label).toBe('16–28 Feb')
  })
})

describe('building invoices', () => {
  it('pre-fills the sales invoice with base fee and an editable commission line', () => {
    const lines = salesInvoiceLines({ baseFee: 1000000, periodLabel: '16–31 Oct', commissionPercent: 5, vatRate: 0 })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ kind: 'fixed', description: 'Base fee 16–31 Oct', quantity: 1, unitPrice: 1000000 })
    expect(lines[1]).toMatchObject({ kind: 'commission', description: 'Commission 16–31 Oct', salesBase: 0, percent: 5 })
  })

  it('makes one time line per day, in date order, linked to the entry', () => {
    const lines = timeLinesFromEntries(
      [
        { id: 't2', ownerId: 'alex', workDate: '2026-10-16', minutes: 145, note: 'Terminology review', invoiceId: null, projectId: null },
        { id: 't1', ownerId: 'alex', workDate: '2026-10-14', minutes: 435, note: 'Contract EN→SV', invoiceId: null, projectId: null },
      ],
      65000, 25,
    )
    expect(lines.map((l) => l.description)).toEqual(['Wed 14 Oct · Contract EN→SV', 'Fri 16 Oct · Terminology review'])
    expect(lines[0]).toMatchObject({ kind: 'time', minutes: 435, hourlyRate: 65000, timeEntryId: 't1', workDate: '2026-10-14' })
  })

  it('creates a credit note that negates the original', () => {
    const original = invoice()
    const credit = createCreditNote(original, { id: 'cn-1', number: 'A-0046', issueDate: '2026-10-25' })
    expect(credit.creditsInvoiceId).toBe('inv-1')
    expect(invoiceTotals(credit).gross.amount).toBe(-invoiceTotals(original).gross.amount)
    expect(credit.status).toBe('draft')
  })
})

describe('validation before sending', () => {
  it('requires a client, at least one line and a due date on or after the issue date', () => {
    expect(validateForSending(invoice())).toEqual([])
    expect(validateForSending(invoice({ clientName: ' ', lines: [], dueDate: '2026-10-01' }))).toEqual([
      'Add the client name',
      'Add at least one line',
      'Due date must be on or after the issue date',
    ])
  })
})
