import { describe, expect, it } from 'vitest'
import { grundavdrag, jobbskatteavdrag, egenavgifter, estimateTax, projectFullYear, fSkattAdvice, type TaxInput } from './estimate'
import { FIXTURE_PARAMS as P } from './fixtures'
import { PARAMS_BY_YEAR, paramsForYear } from './params'

const base: TaxInput = {
  params: P, businessIncome: 500_000, expenses: 100_000, otherDeductions: 0, periodiseringsfond: 0,
  homeOffice: 0, mileage: 0, pensionSaving: 0, employmentIncome: 0, birthYear: 1985, municipalRate: 30,
}

describe('grundavdrag (basic allowance)', () => {
  it('follows the official bands, rounded up to the nearest hundred', () => {
    expect(grundavdrag(40_000, P)).toBe(21_200)
    expect(grundavdrag(100_000, P)).toBe(31_300)
    expect(grundavdrag(150_000, P)).toBe(38_500)
    expect(grundavdrag(200_000, P)).toBe(34_100)
    expect(grundavdrag(500_000, P)).toBe(14_700)
  })

  it('never exceeds the income itself', () => {
    expect(grundavdrag(10_000, P)).toBe(10_000)
    expect(grundavdrag(0, P)).toBe(0)
  })
})

describe('jobbskatteavdrag (earned income tax credit)', () => {
  it('uses the band for the work income', () => {
    expect(jobbskatteavdrag({ workIncome: 300_000, grundavdrag: 24_100, municipalRate: 30, params: P })).toBe(30_356)
  })

  it('is capped above the top band', () => {
    expect(jobbskatteavdrag({ workIncome: 1_000_000, grundavdrag: 14_700, municipalRate: 30, params: P })).toBe(Math.round((3.027 * 50_000 - 14_700) * 0.3))
  })

  it('is zero without work income', () => {
    expect(jobbskatteavdrag({ workIncome: 0, grundavdrag: 0, municipalRate: 30, params: P })).toBe(0)
  })
})

describe('egenavgifter (self-employment contributions)', () => {
  it('applies the full rate minus the 7.5% reduction (capped)', () => {
    expect(egenavgifter({ profit: 400_000, birthYear: 1985, params: P })).toEqual({ base: 300_000, amount: 71_910 })
  })

  it('uses the senior rate without reduction from the year after turning 65', () => {
    expect(egenavgifter({ profit: 400_000, birthYear: 1960, params: P }).amount).toBe(30_630)
  })

  it('is zero for a loss', () => {
    expect(egenavgifter({ profit: -10_000, birthYear: 1985, params: P }).amount).toBe(0)
  })
})

describe('estimateTax', () => {
  it('estimates the full tax on business profit', () => {
    const e = estimateTax(base)
    expect(e.surplus).toBe(400_000)
    expect(e.profit).toBe(400_000)
    expect(e.egenavgifter).toBe(71_910)
    expect(e.taxableBusinessIncome).toBe(300_000)
    expect(e.grundavdrag).toBe(24_100)
    expect(e.taxableIncome).toBe(275_900)
    expect(e.municipalTax).toBe(82_770)
    expect(e.stateTax).toBe(0)
    expect(e.jobbskatteavdrag).toBe(30_356)
    expect(e.incomeTaxOnBusiness).toBe(52_414)
    expect(e.total).toBe(124_324)
  })

  it('caps periodiseringsfond at 30% of profit after the egenavgifter schablon', () => {
    const e = estimateTax({ ...base, periodiseringsfond: 1_000_000 })
    expect(e.periodiseringsfondMax).toBe(90_000)
    expect(e.periodiseringsfond).toBe(90_000)
    expect(e.profit).toBe(310_000)
    expect(e.total).toBeLessThan(estimateTax(base).total)
  })

  it('caps the pension deduction at 35% of surplus and adds särskild löneskatt', () => {
    const e = estimateTax({ ...base, pensionSaving: 500_000 })
    expect(e.pensionMax).toBe(140_000)
    expect(e.pensionDeduction).toBe(140_000)
    expect(e.specialPayrollTax).toBe(Math.round(140_000 * 0.2426))
  })

  it('caps the pension deduction at 10 income base amounts', () => {
    const e = estimateTax({ ...base, businessIncome: 3_000_000, pensionSaving: 2_000_000 })
    expect(e.pensionMax).toBe(700_000)
  })

  it('subtracts home office and mileage deductions from profit', () => {
    expect(estimateTax({ ...base, homeOffice: 4_000, mileage: 1_000 }).surplus).toBe(395_000)
  })

  it('adds state tax above the threshold', () => {
    const e = estimateTax({ ...base, businessIncome: 1_100_000 })
    expect(e.stateTax).toBe(Math.round((e.taxableIncome - 600_000) * 0.2))
  })

  it('only counts the extra tax caused by business income when there is a salary too', () => {
    const salaryOnly = estimateTax({ ...base, businessIncome: 0, expenses: 0, employmentIncome: 400_000 })
    expect(salaryOnly.incomeTaxOnBusiness).toBe(0)
    expect(salaryOnly.total).toBe(0)
    const both = estimateTax({ ...base, employmentIncome: 400_000 })
    expect(both.incomeTaxOnBusiness).toBeGreaterThan(estimateTax(base).incomeTaxOnBusiness)
  })

  it('returns zero tax for a loss', () => {
    expect(estimateTax({ ...base, businessIncome: 50_000 }).total).toBe(0)
  })
})

describe('projection and F-skatt', () => {
  it('projects year-to-date figures to a full year', () => {
    expect(projectFullYear(300_000, '2026-07-02')).toBe(Math.round(300_000 / (183 / 365)))
  })

  it('suggests a new monthly F-skatt when the estimate is not covered', () => {
    expect(fSkattAdvice({ estimatedAnnualTax: 150_000, monthlyFskatt: 10_000, today: '2026-10-20' })).toEqual({
      plannedTotal: 120_000, shortfall: 30_000, monthsLeft: 2, suggestedMonthly: 25_000,
    })
  })

  it('reports no shortfall when the planned F-skatt covers the estimate', () => {
    expect(fSkattAdvice({ estimatedAnnualTax: 100_000, monthlyFskatt: 10_000, today: '2026-10-20' }).shortfall).toBe(0)
  })
})

describe('tax year params', () => {
  it('ships seed params for 2026 and falls back to the latest year', () => {
    expect(PARAMS_BY_YEAR[2026].year).toBe(2026)
    expect(paramsForYear(2030).year).toBe(2026)
  })
})
