import { describe, expect, it } from 'vitest'
import { toMinutes, splitMinutes, formatDuration, validateDayMinutes, HOUR_OPTIONS, MINUTE_OPTIONS, amountForMinutes } from './duration'
import { money } from './money'

describe('duration', () => {
  it('converts hours and minutes dropdown values to minutes', () => {
    expect(toMinutes(6, 30)).toBe(390)
    expect(toMinutes(0, 45)).toBe(45)
  })

  it('splits minutes back into hours and minutes', () => {
    expect(splitMinutes(435)).toEqual({ hours: 7, minutes: 15 })
  })

  it('formats as "6 h 30 min" with two-digit minutes', () => {
    expect(formatDuration(390)).toBe('6 h 30 min')
    expect(formatDuration(420)).toBe('7 h 00 min')
    expect(formatDuration(5)).toBe('0 h 05 min')
    expect(formatDuration(1260)).toBe('21 h 00 min')
  })

  it('offers 0–24 hours and 00–55 minutes in 5-minute steps', () => {
    expect(HOUR_OPTIONS[0]).toBe(0)
    expect(HOUR_OPTIONS.at(-1)).toBe(24)
    expect(MINUTE_OPTIONS).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  })

  it('accepts a day between 1 minute and 24 h 00 min', () => {
    expect(validateDayMinutes(390)).toBeNull()
    expect(validateDayMinutes(1440)).toBeNull()
    expect(validateDayMinutes(0)).toBe('Pick at least 5 minutes')
    expect(validateDayMinutes(1445)).toBe('A day can have at most 24 h 00 min')
  })

  it('prices minutes at an hourly rate, rounded to öre', () => {
    expect(amountForMinutes(390, money(65000, 'SEK'))).toEqual(money(422500, 'SEK'))
    expect(amountForMinutes(10, money(65000, 'SEK'))).toEqual(money(10833, 'SEK'))
  })
})
