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

  it('without an hourly rate, lists the days with their time and adds one total amount line', () => {
    const { invoice } = buildNewInvoice({ ...alex, hourlyRate: 0 }, { today: '2026-10-21', unbilled: seed.timeEntries })
    const days = invoice.lines.filter((l) => l.kind === 'time')
    expect(days).toHaveLength(4)
    expect(days.every((l) => l.kind === 'time' && l.hourlyRate === null)).toBe(true)
    expect(invoice.lines.at(-1)).toMatchObject({ kind: 'fixed', description: 'Translation services', quantity: 1, unitPrice: 0, vatRate: 25 })
  })

  it('starts a translator invoice with an empty day when nothing is unbilled', () => {
    const { invoice } = buildNewInvoice(alex, { today: '2026-10-21', unbilled: [] })
    expect(invoice.lines).toEqual([expect.objectContaining({ kind: 'time', workDate: '2026-10-21', minutes: 0 })])
  })

  it('fills a sales invoice with base fee and a commission amount, in the usual currency', () => {
    const { invoice } = buildNewInvoice({ ...sam, defaultCurrency: 'USD' }, { today: '2026-10-21', unbilled: [], fxRateToSek: 10.4 })
    expect(invoice).toMatchObject({ currency: 'USD', fxRateToSek: 10.4, vatTreatment: 'exempt', dueDate: '2026-11-05' })
    expect(invoice.lines.map((l) => l.description)).toEqual(['Base fee 16–31 Oct', 'Commission 16–31 Oct'])
    expect(invoice.lines[0]).toMatchObject({ kind: 'fixed', unitPrice: 1_000_000 })
    expect(invoice.lines[1]).toMatchObject({ kind: 'fixed', quantity: 1, unitPrice: 0 })
  })

  it('uses SEK and rate 1 for someone who invoices in kronor', () => {
    const { invoice } = buildNewInvoice(alex, { today: '2026-10-21', unbilled: [], fxRateToSek: 10.4 })
    expect(invoice).toMatchObject({ currency: 'SEK', fxRateToSek: 1 })
  })
})
