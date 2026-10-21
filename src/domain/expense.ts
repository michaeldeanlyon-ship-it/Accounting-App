import type { IsoDate } from './dates'
import { convertToSek, money, roundHalfAwayFromZero, type Currency, type Money } from './money'
import type { TaxYearParams } from './tax/params'

export const EXPENSE_CATEGORIES = {
  software: 'Software and subscriptions',
  equipment: 'Equipment (inventarier)',
  phone: 'Phone and internet',
  travel: 'Travel',
  office: 'Office supplies',
  education: 'Courses and books',
  insurance: 'Insurance',
  accounting: 'Accounting and bank fees',
  marketing: 'Marketing',
  other: 'Other',
} as const
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES

export interface Expense {
  id: string
  ownerId: string
  date: IsoDate
  supplier: string
  category: ExpenseCategory
  /** Amount paid including VAT, minor units of `currency`. */
  amountGross: number
  /** VAT included in the gross amount, minor units. */
  vatAmount: number
  currency: Currency
  fxRateToSek: number
  /** Business share, 0–100. A phone used half privately is 50. */
  deductiblePercent: number
  receiptPath: string | null
  note: string
}

export type Housing = 'house' | 'apartment'

export function vatFromGross(gross: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0
  return roundHalfAwayFromZero((gross * ratePercent) / (100 + ratePercent))
}

function share(amount: number, percent: number): number {
  return roundHalfAwayFromZero((amount * percent) / 100)
}

/** Cost that reduces profit: excluding VAT when it can be reclaimed, scaled by the business share. */
export function deductibleCostSek(expense: Expense, vatRegistered: boolean): Money {
  const net = vatRegistered ? expense.amountGross - expense.vatAmount : expense.amountGross
  return convertToSek(money(share(net, expense.deductiblePercent), expense.currency), expense.fxRateToSek)
}

/** Input VAT (ingående moms) that can be reclaimed on the moms return. */
export function reclaimableVatSek(expense: Expense, vatRegistered: boolean): Money {
  if (!vatRegistered) return money(0, 'SEK')
  return convertToSek(money(share(expense.vatAmount, expense.deductiblePercent), expense.currency), expense.fxRateToSek)
}

/** Deduction for driving an own car for business, in whole kronor. One mil is 10 km. */
export function mileageDeduction(mil: number, params: TaxYearParams): number {
  return Math.round(mil * params.mileagePerMil)
}

export function homeOfficeDeduction(housing: Housing, params: TaxYearParams): number {
  return housing === 'house' ? params.homeOfficeHouse : params.homeOfficeApartment
}

export interface Deduction {
  id: string
  ownerId: string
  year: number
  type: 'home_office' | 'mileage' | 'other'
  /** Whole kronor. */
  amount: number
  /** Swedish mil driven, for mileage. */
  distanceMil?: number
  note: string
}

export const DEDUCTION_LABELS: Record<Deduction['type'], string> = {
  home_office: 'Home office (schablonavdrag)',
  mileage: 'Own car for business (milersättning)',
  other: 'Other deduction',
}
