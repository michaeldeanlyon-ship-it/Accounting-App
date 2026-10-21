import type { Housing } from './expense'
import type { Currency } from './money'
import type { VatTreatment } from './vat'

export type VatPeriod = 'monthly' | 'quarterly' | 'yearly'
export type AccountingMethod = 'cash' | 'invoice'
export type WorkStyle = 'hourly' | 'base_commission'

/** One freelancer and their enskild firma. Money in minor units (öre), tax amounts in whole kronor. */
export interface Person {
  id: string
  displayName: string
  roleTitle: string
  workStyle: WorkStyle
  color: string
  businessName: string
  orgNumber: string
  address: string
  email: string
  phone: string
  vatRegistered: boolean
  vatNumber: string
  vatPeriod: VatPeriod
  accountingMethod: AccountingMethod
  municipalRate: number
  birthYear: number
  employmentIncome: number
  monthlyFskatt: number
  hasOccupationalPension: boolean
  housing: Housing
  bankgiro: string
  iban: string
  bic: string
  invoicePrefix: string
  nextInvoiceNumber: number
  paymentTermsDays: number
  hourlyRate: number
  baseFee: number
  commissionPercent: number
  defaultClientName: string
  /** Currency new invoices start in, e.g. USD for a US client. */
  defaultCurrency: Currency
  /** VAT choice new invoices start with, e.g. 'export' for a company in the USA. */
  defaultVatTreatment: VatTreatment
}

export const VAT_PERIOD_LABELS: Record<VatPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export const ACCOUNTING_METHOD_LABELS: Record<AccountingMethod, string> = {
  cash: 'Cash method (kontantmetoden)',
  invoice: 'Invoice method (faktureringsmetoden)',
}

function luhnValid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[i]) * (i % 2 === 0 ? 2 : 1)
    if (d > 9) d -= 9
    sum += d
  }
  return sum % 10 === 0
}

function tenDigits(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 12) return digits.slice(2)
  return null
}

/** Personnummer (enskild firma) or organisationsnummer, with or without century and dash. */
export function isValidOrgNumber(value: string): boolean {
  const digits = tenDigits(value)
  return digits !== null && luhnValid(digits)
}

export function isValidSwedishVatNumber(value: string): boolean {
  const match = value.replace(/\s/g, '').toUpperCase().match(/^SE(\d{10})01$/)
  return match !== null && luhnValid(match[1])
}

export function vatNumberFromOrgNumber(orgNumber: string): string {
  const digits = tenDigits(orgNumber)
  return digits ? `SE${digits}01` : ''
}

export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, '0')}`
}
