import { describe, expect, it } from 'vitest'
import { momsDueDate, euSalesListDueDate, fSkattDates, upcomingDeadlines } from './deadlines'

describe('moms (VAT return) due dates', () => {
  it('quarterly: 12th of the second month after the quarter, 17 August for Q2', () => {
    expect(momsDueDate('quarterly', 2026, 1, false)).toBe('2026-05-12')
    expect(momsDueDate('quarterly', 2026, 2, false)).toBe('2026-08-17')
    expect(momsDueDate('quarterly', 2026, 3, false)).toBe('2026-11-12')
    expect(momsDueDate('quarterly', 2026, 4, false)).toBe('2027-02-12')
  })

  it('monthly: moves a weekend due date to Monday', () => {
    expect(momsDueDate('monthly', 2026, 10, false)).toBe('2026-12-14')
  })

  it('yearly: 26 February with EU trade, otherwise 12 May', () => {
    expect(momsDueDate('yearly', 2026, 1, true)).toBe('2027-02-26')
    expect(momsDueDate('yearly', 2026, 1, false)).toBe('2027-05-12')
  })
})

describe('other deadlines', () => {
  it('EU sales list (periodisk sammanställning) is due the 25th after the quarter', () => {
    expect(euSalesListDueDate(2026, 3)).toBe('2026-10-26')
  })

  it('F-skatt is due on the 12th, 17th in January and August, moved off weekends', () => {
    const dates = fSkattDates(2026)
    expect(dates).toHaveLength(12)
    expect(dates[0]).toBe('2026-01-19')
    expect(dates[7]).toBe('2026-08-17')
    expect(dates[11]).toBe('2026-12-14')
  })
})

describe('upcomingDeadlines', () => {
  const people = [
    { id: 'alex', name: 'Alex', vatRegistered: true, vatPeriod: 'quarterly' as const, hasEuSales: true },
    { id: 'sam', name: 'Sam', vatRegistered: false, vatPeriod: 'quarterly' as const, hasEuSales: false },
  ]

  it('lists the next deadlines in date order', () => {
    const list = upcomingDeadlines({ today: '2026-10-21', people, horizonDays: 75 })
    expect(list.map((d) => [d.date, d.kind, d.ownerId ?? null])).toEqual([
      ['2026-10-26', 'eu_sales_list', 'alex'],
      ['2026-11-12', 'f_skatt', null],
      ['2026-11-12', 'moms', 'alex'],
      ['2026-12-14', 'f_skatt', null],
      ['2026-12-31', 'year_end', null],
    ])
  })

  it('labels the moms return with its period', () => {
    const moms = upcomingDeadlines({ today: '2026-10-21', people, horizonDays: 75 }).find((d) => d.kind === 'moms')!
    expect(moms.label).toBe('Moms return Q3 (Jul–Sep)')
  })

  it('never lists moms for someone who is not VAT registered', () => {
    const list = upcomingDeadlines({ today: '2026-10-21', people, horizonDays: 400 })
    expect(list.some((d) => d.kind === 'moms' && d.ownerId === 'sam')).toBe(false)
    expect(list.some((d) => d.kind === 'income_tax_return')).toBe(true)
  })
})
