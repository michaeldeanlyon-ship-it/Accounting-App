import { describe, expect, it } from 'vitest'
import { unbilledEntries, unbilledSummary, billEntries, releaseEntries, type TimeEntry } from './timesheet'
import { money } from './money'

const entries: TimeEntry[] = [
  { id: 'a', ownerId: 'alex', projectId: 'p1', workDate: '2026-10-13', minutes: 390, note: 'Contract', invoiceId: null },
  { id: 'b', ownerId: 'alex', projectId: 'p1', workDate: '2026-10-14', minutes: 435, note: 'Contract', invoiceId: null },
  { id: 'c', ownerId: 'alex', projectId: 'p2', workDate: '2026-10-01', minutes: 60, note: 'Old', invoiceId: 'inv-0' },
]

describe('timesheet', () => {
  it('lists only unbilled entries', () => {
    expect(unbilledEntries(entries).map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('totals unbilled time and value at the hourly rate', () => {
    expect(unbilledSummary(entries, money(65000, 'SEK'))).toEqual({ minutes: 825, amount: money(893750, 'SEK'), count: 2 })
  })

  it('links entries to an invoice', () => {
    const billed = billEntries(entries, ['a', 'b'], 'inv-1')
    expect(billed.filter((e) => e.invoiceId === 'inv-1').map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('prevents billing the same day twice', () => {
    expect(() => billEntries(entries, ['c'], 'inv-1')).toThrow(/already on an invoice/)
  })

  it('releases entries when a draft invoice is deleted', () => {
    const released = releaseEntries(entries, 'inv-0')
    expect(released.find((e) => e.id === 'c')?.invoiceId).toBeNull()
  })
})
