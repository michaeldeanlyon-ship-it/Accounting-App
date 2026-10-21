import { describe, expect, it } from 'vitest'
import {
  personFromRow, personToRow, invoiceFromRow, invoiceToRpc, timeEntryFromRow, timeEntryToRow, expenseFromRow, expenseToRow,
} from './supabaseMappers'
import { demoSeed } from './demoSeed'
import type { Invoice } from '../domain/invoice'

const seed = demoSeed('2026-10-21')

describe('supabase mappers', () => {
  it('round-trips a person', () => {
    const person = seed.people[0]
    expect(personFromRow(personToRow(person))).toEqual(person)
  })

  it('reads numeric columns sent as strings', () => {
    const row = { ...personToRow(seed.people[0]), municipal_rate: '32.38', commission_percent: '5.000' }
    expect(personFromRow(row).municipalRate).toBe(32.38)
    expect(personFromRow(row).commissionPercent).toBe(5)
  })

  it('builds the save_invoice payload and reads it back, keeping line order', () => {
    const invoice: Invoice = {
      ...seed.invoices[0],
      lines: [
        { id: 'l1', kind: 'time', description: 'Mon 12 Oct · Contract', workDate: '2026-10-12', minutes: 390, hourlyRate: 65_000, vatRate: 25, timeEntryId: 't1' },
        { id: 'l2', kind: 'fixed', description: 'Rush fee', quantity: 1, unit: 'st', unitPrice: 50_000, vatRate: 25 },
        { id: 'l3', kind: 'commission', description: 'Commission', salesBase: 4_500_000, percent: 5, vatRate: 0 },
      ],
    }
    const { p_invoice, p_lines } = invoiceToRpc(invoice)
    expect(p_invoice.owner_id).toBe(invoice.ownerId)
    expect(p_lines[0]).toMatchObject({ id: 'l1', kind: 'time', minutes: 390, hourly_rate: 65_000, work_date: '2026-10-12', time_entry_id: 't1' })
    expect(p_lines[2]).toMatchObject({ kind: 'commission', sales_base: 4_500_000, percent: 5 })

    const row = {
      ...p_invoice,
      fx_rate_to_sek: '1.000000',
      invoice_lines: p_lines.map((l, position) => ({ ...l, position, quantity: l.quantity === null ? null : String(l.quantity) })).reverse(),
    }
    expect(invoiceFromRow(row)).toEqual(invoice)
  })

  it('round-trips a time entry and an expense', () => {
    expect(timeEntryFromRow(timeEntryToRow(seed.timeEntries[0]))).toEqual(seed.timeEntries[0])
    expect(expenseFromRow(expenseToRow(seed.expenses[0]))).toEqual(seed.expenses[0])
  })
})

describe('mapping the new invoice fields', () => {
  it('keeps time-only lines (no hourly rate) and the SEK received', () => {
    const invoice: Invoice = {
      ...seed.invoices[0], currency: 'USD', fxRateToSek: 10.4, paidDate: '2026-10-30', paidAmount: 100_000, paidAmountSek: 1_032_500,
      lines: [{ id: 'l1', kind: 'time', description: 'Mon 19 Oct · Contract', workDate: '2026-10-19', minutes: 390, hourlyRate: null, vatRate: 25 }],
    }
    const { p_invoice, p_lines } = invoiceToRpc(invoice)
    expect(p_invoice.paid_amount_sek).toBe(1_032_500)
    expect(p_lines[0].hourly_rate).toBeNull()
    expect(invoiceFromRow({ ...p_invoice, invoice_lines: p_lines.map((l, position) => ({ ...l, position })) })).toEqual(invoice)
  })
})
