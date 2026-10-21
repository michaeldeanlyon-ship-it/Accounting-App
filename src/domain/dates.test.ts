import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, monthKey, formatDayLabel, nextWeekday, dayOfYearFraction } from './dates'

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-10-20', 15)).toBe('2026-11-04')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('counts days between ISO dates (negative when in the past)', () => {
    expect(daysBetween('2026-10-20', '2026-10-27')).toBe(7)
    expect(daysBetween('2026-10-20', '2026-10-14')).toBe(-6)
  })

  it('returns the month key', () => {
    expect(monthKey('2026-10-08')).toBe('2026-10')
  })

  it('formats a work day as weekday, day and month', () => {
    expect(formatDayLabel('2026-10-14')).toBe('Wed 14 Oct')
  })

  it('moves weekend dates to the next Monday', () => {
    expect(nextWeekday('2026-12-12')).toBe('2026-12-14') // Saturday
    expect(nextWeekday('2026-12-13')).toBe('2026-12-14') // Sunday
    expect(nextWeekday('2026-11-12')).toBe('2026-11-12') // Thursday
  })

  it('gives the share of the year that has passed', () => {
    expect(dayOfYearFraction('2026-12-31')).toBeCloseTo(1, 5)
    expect(dayOfYearFraction('2026-07-02')).toBeCloseTo(183 / 365, 5)
  })
})
