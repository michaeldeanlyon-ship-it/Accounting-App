import { describe, expect, it } from 'vitest'
import { buildNewInvoice } from './newInvoice'
import { demoSeed } from '../../data/demoSeed'

const seed = demoSeed('2026-10-21')
const alex = seed.people.find((p) => p.id === 'alex')!
const sam = seed.people.find((p) => p.id === 'sam')!

describe('buildNewInvoice', () => {
  it('fills a translator invoice with one line per unbilled day', () => {
    const { invoice, timeEntryIds } = buildNewInvoice(alex, { today: '2026-10-21', unbilled: seed.timeEntries })
    expect(invoice.lines).toHaveLength(4)
    expect(invoice.lines.every((l) => l.kind === 'time' && l.hourlyRate === 65_000 && l.vatRate === 25)).toBe(true)
    expect(timeEntryIds).toEqual(['te-1', 'te-2', 'te-3', 'te-4'])
    expect(invoice).toMatchObject({ ownerId: 'alex', status: 'draft', number: '', vatTreatment: 'domestic', clientName: 'Nordic Lingua AB', dueDate: '2026-11-20' })
  })

  it('starts a translator invoice with an empty day when nothing is unbilled', () => {
    const { invoice } = buildNewInvoice(alex, { today: '2026-10-21', unbilled: [] })
    expect(invoice.lines).toEqual([expect.objectContaining({ kind: 'time', workDate: '2026-10-21', minutes: 0 })])
  })

  it('fills a sales invoice with base fee and commission for the half-month, without VAT', () => {
    const { invoice } = buildNewInvoice(sam, { today: '2026-10-21', unbilled: [] })
    expect(invoice.vatTreatment).toBe('exempt')
    expect(invoice.lines.map((l) => l.description)).toEqual(['Base fee 16–31 Oct', 'Commission 16–31 Oct'])
    expect(invoice.lines[0]).toMatchObject({ kind: 'fixed', unitPrice: 1_000_000 })
    expect(invoice.lines[1]).toMatchObject({ kind: 'commission', percent: 5, salesBase: 0 })
    expect(invoice.dueDate).toBe('2026-11-05')
  })
})
