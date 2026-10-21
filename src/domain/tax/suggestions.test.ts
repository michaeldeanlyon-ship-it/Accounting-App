import { describe, expect, it } from 'vitest'
import { taxSuggestions, type SuggestionContext } from './suggestions'
import { FIXTURE_PARAMS as P } from './fixtures'
import type { TaxInput } from './estimate'

const input: TaxInput = {
  params: P, businessIncome: 500_000, expenses: 100_000, otherDeductions: 0, periodiseringsfond: 0,
  homeOffice: 0, mileage: 0, pensionSaving: 0, employmentIncome: 0, birthYear: 1985, municipalRate: 30,
}
const ctx = (over: Partial<SuggestionContext> = {}): SuggestionContext => ({
  input, vatRegistered: true, turnoverThisYear: 500_000, hasOccupationalPension: false,
  housing: 'apartment', today: '2026-10-21', monthlyFskatt: 15_000, ...over,
})
const ids = (c: SuggestionContext) => taxSuggestions(c).map((s) => s.id)

describe('tax suggestions', () => {
  it('suggests the maximum periodiseringsfond with the tax saved this year', () => {
    const s = taxSuggestions(ctx()).find((x) => x.id === 'periodiseringsfond')!
    expect(s.saving).toBeGreaterThan(0)
    expect(s.title).toContain('90 000 kr')
  })

  it('skips periodiseringsfond once it is used in full', () => {
    expect(ids(ctx({ input: { ...input, periodiseringsfond: 90_000 } }))).not.toContain('periodiseringsfond')
  })

  it('suggests pension saving only without a tjänstepension', () => {
    expect(ids(ctx())).toContain('pension')
    expect(ids(ctx({ hasOccupationalPension: true }))).not.toContain('pension')
  })

  it('suggests the home office schablon for the housing type', () => {
    const s = taxSuggestions(ctx()).find((x) => x.id === 'home_office')!
    expect(s.title).toContain('4 000 kr')
    expect(ids(ctx({ input: { ...input, homeOffice: 4_000 } }))).not.toContain('home_office')
  })

  it('reminds about mileage when none is logged', () => {
    expect(ids(ctx())).toContain('mileage')
    expect(ids(ctx({ input: { ...input, mileage: 500 } }))).not.toContain('mileage')
  })

  it('mentions direct deduction for equipment near the year end only', () => {
    expect(ids(ctx())).toContain('equipment')
    expect(ids(ctx({ today: '2026-04-01' }))).not.toContain('equipment')
  })

  it('mentions expansionsfond only when state tax is paid', () => {
    expect(ids(ctx())).not.toContain('expansionsfond')
    expect(ids(ctx({ input: { ...input, businessIncome: 1_500_000 } }))).toContain('expansionsfond')
  })

  it('reminds a VAT-registered person to reclaim input moms', () => {
    expect(ids(ctx())).toContain('input_vat')
    expect(ids(ctx({ vatRegistered: false, turnoverThisYear: 10_000 }))).not.toContain('input_vat')
  })

  it('warns a non-registered person approaching or passing the VAT limit', () => {
    const near = taxSuggestions(ctx({ vatRegistered: false, turnoverThisYear: 100_000 })).find((s) => s.id === 'vat_registration')!
    expect(near.severity).toBe('warning')
    expect(near.title).toMatch(/approaching/i)
    const over = taxSuggestions(ctx({ vatRegistered: false, turnoverThisYear: 125_000 })).find((s) => s.id === 'vat_registration')!
    expect(over.title).toMatch(/register for VAT/i)
    expect(ids(ctx({ vatRegistered: false, turnoverThisYear: 50_000 }))).not.toContain('vat_registration')
  })

  it('warns when F-skatt will not cover the estimate', () => {
    expect(ids(ctx({ monthlyFskatt: 1_000 }))).toContain('f_skatt')
    expect(ids(ctx({ monthlyFskatt: 50_000 }))).not.toContain('f_skatt')
  })

  it('lists warnings first, then the biggest savings', () => {
    const list = taxSuggestions(ctx({ monthlyFskatt: 1_000 }))
    expect(list[0].severity).toBe('warning')
    const tips = list.filter((s) => s.severity === 'tip').map((s) => s.saving)
    expect(tips).toEqual([...tips].sort((a, b) => b - a))
  })
})
