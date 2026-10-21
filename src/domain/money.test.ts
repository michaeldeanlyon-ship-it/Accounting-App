import { describe, expect, it } from 'vitest'
import { money, fromMajor, toMajor, addMoney, sumMoney, multiplyMoney, percentOf, convertToSek, formatMoney, ZERO_SEK } from './money'

describe('money', () => {
  it('stores amounts as integer minor units (öre)', () => {
    expect(fromMajor(12.5, 'SEK')).toEqual({ amount: 1250, currency: 'SEK' })
    expect(toMajor(money(1250, 'SEK'))).toBe(12.5)
  })

  it('rejects non-integer minor amounts', () => {
    expect(() => money(10.5, 'SEK')).toThrow(/integer/)
  })

  it('rounds half away from zero when converting from major units', () => {
    expect(fromMajor(0.005, 'SEK').amount).toBe(1)
    expect(fromMajor(-0.005, 'SEK').amount).toBe(-1)
    expect(fromMajor(1.004, 'SEK').amount).toBe(100)
  })

  it('adds money in the same currency', () => {
    expect(addMoney(money(100, 'SEK'), money(250, 'SEK'))).toEqual(money(350, 'SEK'))
  })

  it('refuses to add different currencies', () => {
    expect(() => addMoney(money(100, 'SEK'), money(100, 'EUR'))).toThrow(/currenc/i)
  })

  it('sums a list, returning zero for an empty list', () => {
    expect(sumMoney([], 'SEK')).toEqual(ZERO_SEK)
    expect(sumMoney([money(1, 'SEK'), money(2, 'SEK')], 'SEK')).toEqual(money(3, 'SEK'))
  })

  it('multiplies and rounds to whole öre', () => {
    expect(multiplyMoney(money(65000, 'SEK'), 6.5)).toEqual(money(422500, 'SEK'))
    expect(multiplyMoney(money(333, 'SEK'), 0.5)).toEqual(money(167, 'SEK'))
  })

  it('takes a percentage', () => {
    expect(percentOf(money(4500000, 'SEK'), 5)).toEqual(money(225000, 'SEK'))
    expect(percentOf(money(1000, 'SEK'), 25)).toEqual(money(250, 'SEK'))
  })

  it('converts foreign currency to SEK with the stored rate', () => {
    expect(convertToSek(money(240000, 'EUR'), 11.5)).toEqual(money(2760000, 'SEK'))
    expect(convertToSek(money(1000, 'SEK'), 1)).toEqual(money(1000, 'SEK'))
  })

  it('refuses a non-positive exchange rate', () => {
    expect(() => convertToSek(money(100, 'EUR'), 0)).toThrow(/rate/)
  })

  it('formats SEK the Swedish way and other currencies with their symbol', () => {
    expect(formatMoney(money(1250000, 'SEK'))).toBe('12 500,00 kr')
    expect(formatMoney(money(1250000, 'SEK'), { decimals: 0 })).toBe('12 500 kr')
    expect(formatMoney(money(240000, 'EUR'))).toBe('€2,400.00')
    expect(formatMoney(money(-50000, 'SEK'), { decimals: 0 })).toBe('-500 kr')
  })

  it('never shows a negative zero', () => {
    expect(formatMoney(money(-0, 'SEK'), { decimals: 0 })).toBe('0 kr')
    expect(formatMoney(money(-40, 'SEK'), { decimals: 0 })).toBe('0 kr')
  })
})
