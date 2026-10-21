import { yearOf, type IsoDate } from '../../domain/dates'
import { fSkattDates } from '../../domain/deadlines'
import { deductibleCostSek, type Deduction, type Expense } from '../../domain/expense'
import { invoiceTotals, receivedNetSek, type Invoice } from '../../domain/invoice'
import type { Person } from '../../domain/person'
import { estimateTax, fSkattAdvice, projectFullYear, type TaxEstimate, type TaxInput } from '../../domain/tax/estimate'
import type { TaxYearParams } from '../../domain/tax/params'

interface Sources {
  person: Person
  invoices: readonly Invoice[]
  expenses: readonly Expense[]
  deductions: readonly Deduction[]
  today: IsoDate
}

export interface YearToDate {
  /** Whole kronor, excluding VAT. */
  income: number
  expenses: number
  homeOffice: number
  mileage: number
  otherDeductions: number
}

const kr = (ore: number) => Math.round(ore / 100)

export function yearToDate({ person, invoices, expenses, deductions, today }: Sources): YearToDate {
  const year = yearOf(today)
  const inYear = (date: IsoDate | null) => date !== null && yearOf(date) === year && date <= today
  const mine = invoices.filter((i) => i.ownerId === person.id && i.status !== 'draft')

  const income =
    person.accountingMethod === 'cash'
      ? mine.filter((i) => inYear(i.paidDate)).reduce((sum, i) => sum + receivedNetSek(i).amount, 0)
      : mine.filter((i) => inYear(i.issueDate)).reduce((sum, i) => sum + invoiceTotals(i).netSek.amount, 0)

  const cost = expenses
    .filter((e) => e.ownerId === person.id && inYear(e.date))
    .reduce((sum, e) => sum + deductibleCostSek(e, person.vatRegistered).amount, 0)

  const mineDeductions = deductions.filter((d) => d.ownerId === person.id && d.year === year)
  const total = (type: Deduction['type']) => mineDeductions.filter((d) => d.type === type).reduce((s, d) => s + d.amount, 0)

  return { income: kr(income), expenses: kr(cost), homeOffice: total('home_office'), mileage: total('mileage'), otherDeductions: total('other') }
}

export function fSkattPaidSoFar(monthly: number, today: IsoDate): number {
  return fSkattDates(yearOf(today)).filter((d) => d <= today).length * monthly
}

export interface TaxPlan {
  periodiseringsfond: number
  pensionSaving: number
}

export interface PersonTaxSummary {
  ytd: YearToDate
  /** Full-year input, with income and expenses projected at the year-to-date pace. */
  input: TaxInput
  estimate: TaxEstimate
  fSkattPaid: number
  advice: ReturnType<typeof fSkattAdvice>
}

export function personTaxSummary(sources: Sources & { params: TaxYearParams; plan: TaxPlan }): PersonTaxSummary {
  const { person, params, plan, today } = sources
  const ytd = yearToDate(sources)
  const input: TaxInput = {
    params,
    businessIncome: projectFullYear(ytd.income, today),
    expenses: projectFullYear(ytd.expenses, today),
    otherDeductions: ytd.otherDeductions,
    periodiseringsfond: plan.periodiseringsfond,
    homeOffice: ytd.homeOffice,
    mileage: ytd.mileage,
    pensionSaving: plan.pensionSaving,
    employmentIncome: person.employmentIncome,
    birthYear: person.birthYear,
    municipalRate: person.municipalRate,
  }
  const estimate = estimateTax(input)
  return {
    ytd,
    input,
    estimate,
    fSkattPaid: fSkattPaidSoFar(person.monthlyFskatt, today),
    advice: fSkattAdvice({ estimatedAnnualTax: estimate.total, monthlyFskatt: person.monthlyFskatt, today }),
  }
}
