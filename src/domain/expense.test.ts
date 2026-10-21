import { describe, expect, it } from 'vitest'
import { vatFromGross, deductibleCostSek, reclaimableVatSek, mileageDeduction, homeOfficeDeduction, type Expense } from './expense'
import { money } from './money'
import { FIXTURE_PARAMS } from './tax/fixtures'

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e', ownerId: 'alex', date: '2026-10-02', supplier: 'Adobe', category: 'software', amountGross: 125_000,
  vatAmount: 25_000, currency: 'SEK', fxRateToSek: 1, deductiblePercent: 100, receiptPath: null, note: '', ...over,
})

describe('expenses', () => {
  it('splits the VAT out of a gross amount', () => {
    expect(vatFromGross(125_000, 25)).toBe(25_000)
    expect(vatFromGross(10_600, 6)).toBe(600)
    expect(vatFromGross(1_000, 0)).toBe(0)
  })

  it('deducts the cost without VAT for a VAT-registered person', () => {
    expect(deductibleCostSek(expense(), true)).toEqual(money(100_000, 'SEK'))
    expect(reclaimableVatSek(expense(), true)).toEqual(money(25_000, 'SEK'))
  })

  it('deducts the full cost and reclaims nothing when not VAT registered', () => {
    expect(deductibleCostSek(expense(), false)).toEqual(money(125_000, 'SEK'))
    expect(reclaimableVatSek(expense(), false)).toEqual(money(0, 'SEK'))
  })

  it('applies a partial business share, such as a phone used half privately', () => {
    expect(deductibleCostSek(expense({ deductiblePercent: 50 }), true)).toEqual(money(50_000, 'SEK'))
    expect(reclaimableVatSek(expense({ deductiblePercent: 50 }), true)).toEqual(money(12_500, 'SEK'))
  })

  it('converts foreign expenses to SEK', () => {
    expect(deductibleCostSek(expense({ currency: 'EUR', fxRateToSek: 11.5, amountGross: 1_000, vatAmount: 0 }), true))
      .toEqual(money(11_500, 'SEK'))
  })
})

describe('standard deductions', () => {
  it('pays 25 kr per Swedish mil for an own car', () => {
    expect(mileageDeduction(120, FIXTURE_PARAMS)).toBe(3_000)
  })

  it('gives the home office schablon for the housing type', () => {
    expect(homeOfficeDeduction('house', FIXTURE_PARAMS)).toBe(2_000)
    expect(homeOfficeDeduction('apartment', FIXTURE_PARAMS)).toBe(4_000)
  })
})
