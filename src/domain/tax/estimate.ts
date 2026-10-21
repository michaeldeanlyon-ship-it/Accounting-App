import { dayOfYearFraction, parseIso, type IsoDate } from '../dates'
import type { TaxYearParams } from './params'

/**
 * A planning estimate of the tax on one person's enskild firma for a year. All amounts are whole kronor.
 * Simplified on purpose: it ignores public service fee, räntefördelning and förhöjt grundavdrag for seniors.
 */
export interface TaxInput {
  params: TaxYearParams
  /** Business income excluding VAT. */
  businessIncome: number
  /** Deductible costs excluding reclaimable VAT. */
  expenses: number
  otherDeductions: number
  /** Amount the person wants to set aside; capped at the legal maximum. */
  periodiseringsfond: number
  homeOffice: number
  mileage: number
  /** Private pension saving deducted in the business; capped at the legal maximum. */
  pensionSaving: number
  /** Salary from an employer (tax already withheld there). */
  employmentIncome: number
  birthYear: number
  /** Kommunalskatt in percent, e.g. 32.38. */
  municipalRate: number
}

export interface TaxEstimate {
  surplus: number
  pensionMax: number
  pensionDeduction: number
  periodiseringsfondMax: number
  periodiseringsfond: number
  profit: number
  egenavgifterBase: number
  egenavgifter: number
  taxableBusinessIncome: number
  grundavdrag: number
  taxableIncome: number
  municipalTax: number
  stateTax: number
  jobbskatteavdrag: number
  incomeTaxOnBusiness: number
  specialPayrollTax: number
  /** Tax caused by the business, to be covered by F-skatt. */
  total: number
}

const roundUpToHundred = (n: number) => Math.ceil(n / 100) * 100
const roundDownToHundred = (n: number) => Math.floor(n / 100) * 100

/** Grundavdrag for people under 66, from fastställd förvärvsinkomst. */
export function grundavdrag(income: number, params: TaxYearParams): number {
  if (income <= 0) return 0
  const pbb = params.pbb
  let amount: number
  if (income <= 0.99 * pbb) amount = 0.423 * pbb
  else if (income <= 2.72 * pbb) amount = 0.423 * pbb + 0.2 * (income - 0.99 * pbb)
  else if (income <= 3.11 * pbb) amount = 0.77 * pbb
  else if (income <= 7.88 * pbb) amount = 0.77 * pbb - 0.1 * (income - 3.11 * pbb)
  else amount = 0.293 * pbb
  return Math.min(roundUpToHundred(amount), income)
}

export function jobbskatteavdrag(input: { workIncome: number; grundavdrag: number; municipalRate: number; params: TaxYearParams }): number {
  const { workIncome: ai, grundavdrag: ga, params } = input
  if (ai <= 0) return 0
  const j = params.jobbskatteavdrag
  const pbb = params.pbb
  let credited: number
  if (ai <= j.band1 * pbb) credited = ai - ga
  else if (ai <= j.band2 * pbb) credited = j.base2 * pbb + j.rate2 * (ai - j.band1 * pbb) - ga
  else if (ai <= j.band3 * pbb) credited = j.base3 * pbb + j.rate3 * (ai - j.band2 * pbb) - ga
  else credited = j.max * pbb - ga
  return Math.max(0, Math.round(credited * (input.municipalRate / 100)))
}

export function isSenior(birthYear: number, year: number): boolean {
  return year - birthYear - 1 >= 65
}

export function egenavgifter(input: { profit: number; birthYear: number; params: TaxYearParams }): { base: number; amount: number } {
  const { params } = input
  const base = Math.max(0, Math.round(input.profit * (1 - params.schablonavdragRate)))
  if (base === 0) return { base, amount: 0 }
  if (isSenior(input.birthYear, params.year)) return { base, amount: Math.round(base * params.egenavgiftRateSenior) }
  const reduction = Math.min(base * params.egenavgiftReductionRate, params.egenavgiftReductionMax)
  return { base, amount: Math.round(base * params.egenavgiftRate - reduction) }
}

/** Municipal + state income tax after grundavdrag and jobbskatteavdrag. */
function incomeTax(businessIncome: number, employmentIncome: number, municipalRate: number, params: TaxYearParams) {
  const assessed = Math.max(0, businessIncome) + Math.max(0, employmentIncome)
  const ga = grundavdrag(assessed, params)
  const taxable = roundDownToHundred(Math.max(0, assessed - ga))
  const municipal = Math.round(taxable * (municipalRate / 100))
  const state = Math.round(Math.max(0, taxable - params.stateTaxThreshold) * params.stateTaxRate)
  const jsa = Math.min(municipal, jobbskatteavdrag({ workIncome: assessed, grundavdrag: ga, municipalRate, params }))
  return { ga, taxable, municipal, state, jsa, total: municipal - jsa + state }
}

export function estimateTax(input: TaxInput): TaxEstimate {
  const { params } = input
  const surplus = input.businessIncome - input.expenses - input.otherDeductions - input.homeOffice - input.mileage

  const pensionMax = Math.round(Math.min(Math.max(0, surplus) * params.pensionDeductionRate, params.pensionDeductionMaxIbb * params.ibb))
  const pensionDeduction = Math.min(Math.max(0, input.pensionSaving), pensionMax)
  const afterPension = surplus - pensionDeduction

  const periodiseringsfondMax = Math.floor(Math.max(0, afterPension) * (1 - params.schablonavdragRate) * params.periodiseringsfondRate)
  const periodiseringsfond = Math.min(Math.max(0, input.periodiseringsfond), periodiseringsfondMax)
  const profit = afterPension - periodiseringsfond

  const egen = egenavgifter({ profit, birthYear: input.birthYear, params })
  const taxableBusinessIncome = Math.max(0, profit - Math.round(Math.max(0, profit) * params.schablonavdragRate))

  const withBusiness = incomeTax(taxableBusinessIncome, input.employmentIncome, input.municipalRate, params)
  const salaryOnly = incomeTax(0, input.employmentIncome, input.municipalRate, params)
  const incomeTaxOnBusiness = Math.max(0, withBusiness.total - salaryOnly.total)
  const specialPayrollTax = Math.round(pensionDeduction * params.specialPayrollTaxPension)

  return {
    surplus,
    pensionMax,
    pensionDeduction,
    periodiseringsfondMax,
    periodiseringsfond,
    profit,
    egenavgifterBase: egen.base,
    egenavgifter: egen.amount,
    taxableBusinessIncome,
    grundavdrag: withBusiness.ga,
    taxableIncome: withBusiness.taxable,
    municipalTax: withBusiness.municipal,
    stateTax: withBusiness.state,
    jobbskatteavdrag: withBusiness.jsa,
    incomeTaxOnBusiness,
    specialPayrollTax,
    total: egen.amount + incomeTaxOnBusiness + specialPayrollTax,
  }
}

/** Scales a year-to-date figure up to a full year at the same pace. */
export function projectFullYear(yearToDate: number, today: IsoDate): number {
  return Math.round(yearToDate / dayOfYearFraction(today))
}

/** F-skatt is due on the 12th, except January and August (17th). */
export function fSkattDueDay(month: number): number {
  return month === 1 || month === 8 ? 17 : 12
}

/** Compares the year's planned F-skatt with the estimate and suggests a new monthly amount. */
export function fSkattAdvice(input: { estimatedAnnualTax: number; monthlyFskatt: number; today: IsoDate }) {
  const d = parseIso(input.today)
  const month = d.getUTCMonth() + 1
  const thisMonthStillDue = d.getUTCDate() <= fSkattDueDay(month) ? 1 : 0
  const monthsLeft = 12 - month + thisMonthStillDue
  const plannedTotal = input.monthlyFskatt * 12
  const shortfall = Math.max(0, input.estimatedAnnualTax - plannedTotal)
  const suggestedMonthly = monthsLeft > 0 ? Math.ceil(input.monthlyFskatt + shortfall / monthsLeft) : input.monthlyFskatt
  return { plannedTotal, shortfall, monthsLeft, suggestedMonthly }
}
