import { describe, expect, it } from 'vitest'
import { isValidOrgNumber, isValidSwedishVatNumber, formatInvoiceNumber, vatNumberFromOrgNumber } from './person'

describe('person and business details', () => {
  it('checks Swedish personnummer / organisationsnummer with the Luhn digit', () => {
    expect(isValidOrgNumber('811218-9876')).toBe(true)
    expect(isValidOrgNumber('19811218-9876')).toBe(true)
    expect(isValidOrgNumber('556036-0793')).toBe(true)
    expect(isValidOrgNumber('811218-9877')).toBe(false)
    expect(isValidOrgNumber('12345')).toBe(false)
  })

  it('checks Swedish VAT numbers (SE + 10 digits + 01)', () => {
    expect(isValidSwedishVatNumber('SE556036079301')).toBe(true)
    expect(isValidSwedishVatNumber('SE 5560360793 01')).toBe(true)
    expect(isValidSwedishVatNumber('SE556036079302')).toBe(false)
    expect(isValidSwedishVatNumber('DE123456789')).toBe(false)
  })

  it('derives the VAT number from the org number', () => {
    expect(vatNumberFromOrgNumber('19811218-9876')).toBe('SE811218987601')
  })

  it('formats sequential invoice numbers', () => {
    expect(formatInvoiceNumber('A', 45)).toBe('A-0045')
    expect(formatInvoiceNumber('S', 12345)).toBe('S-12345')
  })
})
