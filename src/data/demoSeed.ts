import { addDays, monthKey, yearOf, type IsoDate } from '../domain/dates'
import type { Deduction, Expense } from '../domain/expense'
import type { Invoice, InvoiceLine } from '../domain/invoice'
import type { Person } from '../domain/person'
import type { TimeEntry } from '../domain/timesheet'

export interface Seed {
  people: Person[]
  invoices: Invoice[]
  timeEntries: TimeEntry[]
  expenses: Expense[]
  deductions: Deduction[]
}

const basePerson = {
  address: '', phone: '', vatNumber: '', vatPeriod: 'quarterly', accountingMethod: 'cash', municipalRate: 32.38,
  employmentIncome: 0, hasOccupationalPension: false, housing: 'apartment', bankgiro: '', iban: '', bic: '',
  paymentTermsDays: 30, hourlyRate: 0, baseFee: 0, commissionPercent: 0, defaultClientName: '',
} as const

function invoice(over: Partial<Invoice> & Pick<Invoice, 'id' | 'ownerId' | 'number' | 'lines'>): Invoice {
  return {
    clientId: null, clientName: '', issueDate: '', dueDate: '', currency: 'SEK', fxRateToSek: 1, vatTreatment: 'domestic',
    status: 'sent', paidDate: null, paidAmount: null, creditsInvoiceId: null, notes: '', ...over,
  }
}

const hours = (id: string, description: string, workDate: IsoDate, minutes: number, rate = 65_000): InvoiceLine => ({
  id, kind: 'time', description, workDate, minutes, hourlyRate: rate, vatRate: 25,
})
const base = (id: string, label: string, fee = 1_000_000): InvoiceLine => ({
  id, kind: 'fixed', description: `Base fee ${label}`, quantity: 1, unit: 'st', unitPrice: fee, vatRate: 0,
})
const commission = (id: string, label: string, sales: number): InvoiceLine => ({
  id, kind: 'commission', description: `Commission ${label}`, salesBase: sales, percent: 5, vatRate: 0,
})

/** Sample data for demo mode, placed around `today` so the dashboard always has something to show. */
export function demoSeed(today: IsoDate): Seed {
  const year = yearOf(today)
  const month = Number(today.slice(5, 7))
  const d = (offset: number) => addDays(today, offset)

  const people: Person[] = [
    {
      ...basePerson, id: 'alex', displayName: 'Alex', roleTitle: 'Translator', workStyle: 'hourly', color: '#7c3aed',
      businessName: 'Alex Översättning', orgNumber: '19881218-9876', email: 'alex@example.com', vatRegistered: true,
      vatNumber: 'SE881218987601', birthYear: 1988, monthlyFskatt: 7_000, bankgiro: '123-4567', invoicePrefix: 'A',
      nextInvoiceNumber: 45, hourlyRate: 65_000, defaultClientName: 'Nordic Lingua AB',
    },
    {
      ...basePerson, id: 'sam', displayName: 'Sam', roleTitle: 'Sales contractor', workStyle: 'base_commission', color: '#0d9488',
      businessName: 'Sam Sales Consulting', orgNumber: '19900101-0017', email: 'sam@example.com', vatRegistered: false,
      birthYear: 1990, monthlyFskatt: 2_000, bankgiro: '765-4321', invoicePrefix: 'S', nextInvoiceNumber: 19,
      baseFee: 1_000_000, commissionPercent: 5, defaultClientName: 'Brightsale AB', paymentTermsDays: 15,
    },
  ]

  const history: Invoice[] = []
  // Alex: one paid invoice for each earlier month this year.
  for (let m = 1; m < month && m <= 9; m++) {
    const end = `${year}-${String(m).padStart(2, '0')}-28`
    const due = addDays(end, 30)
    history.push(invoice({
      id: `alex-h${m}`, ownerId: 'alex', number: `A-${String(31 + m).padStart(4, '0')}`, clientName: 'Nordic Lingua AB',
      issueDate: end, dueDate: due, paidDate: due < today ? due : null,
      lines: [hours(`alex-h${m}-l`, `${monthKey(end)} translation work`, end, (44 + (m % 3) * 4) * 60)],
    }))
  }
  // Sam: twice-monthly invoices for the three months before this one.
  let n = 10
  for (let m = Math.max(1, month - 3); m < month; m++) {
    for (const half of [1, 2]) {
      const mm = String(m).padStart(2, '0')
      const issue = `${year}-${mm}-${half === 1 ? '15' : '28'}`
      const label = half === 1 ? `1–15 ${mm}` : `16–end ${mm}`
      const due = addDays(issue, 15)
      history.push(invoice({
        id: `sam-h${m}-${half}`, ownerId: 'sam', number: `S-${String(n++).padStart(4, '0')}`, clientName: 'Brightsale AB',
        issueDate: issue, dueDate: due, vatTreatment: 'exempt', paidDate: due < today ? due : null,
        lines: [base(`sam-h${m}-${half}-b`, label), commission(`sam-h${m}-${half}-c`, label, 20_000_00 + m * 500_00)],
      }))
    }
  }

  const current: Invoice[] = [
    invoice({
      id: 'alex-41', ownerId: 'alex', number: 'A-0041', clientName: 'Nordic Lingua AB', issueDate: d(-43), dueDate: d(-13), paidDate: d(-13),
      lines: [hours('a41-1', 'Contract translation EN→SV', d(-46), 44 * 60)],
    }),
    invoice({
      id: 'alex-42', ownerId: 'alex', number: 'A-0042', clientName: 'Nordic Lingua AB', issueDate: d(-37), dueDate: d(-7),
      lines: [hours('a42-1', 'Contract EN→SV', d(-44), 450), hours('a42-2', 'Contract EN→SV', d(-43), 495), hours('a42-3', 'Contract EN→SV', d(-41), 435)],
    }),
    invoice({
      id: 'alex-43', ownerId: 'alex', number: 'A-0043', clientName: 'Übersetzung GmbH', clientVatNumber: 'DE123456789', clientAddress: 'Hauptstraße 1, 10115 Berlin',
      issueDate: d(-15), dueDate: d(15), currency: 'EUR', fxRateToSek: 11.5, vatTreatment: 'eu_reverse_charge',
      lines: [{ id: 'a43-1', kind: 'fixed', description: 'Technical manual DE→SV', quantity: 1, unit: 'st', unitPrice: 240_000, vatRate: 25 }],
    }),
    invoice({
      id: 'alex-44', ownerId: 'alex', number: 'A-0044', clientName: 'Studio Fem', issueDate: d(-8), dueDate: d(22),
      lines: [hours('a44-1', 'Subtitling ep. 1', d(-14), 270, 66_000), hours('a44-2', 'Subtitling ep. 2–3', d(-13), 450, 66_000)],
    }),
    invoice({
      id: 'sam-16', ownerId: 'sam', number: 'S-0016', clientName: 'Brightsale AB', issueDate: d(-35), dueDate: d(-20), paidDate: d(-20), vatTreatment: 'exempt',
      lines: [base('s16-b', 'first half'), commission('s16-c', 'first half', 4_000_000)],
    }),
    invoice({
      id: 'sam-17', ownerId: 'sam', number: 'S-0017', clientName: 'Brightsale AB', issueDate: d(-21), dueDate: d(-6), vatTreatment: 'exempt',
      lines: [base('s17-b', 'second half'), commission('s17-c', 'second half', 5_000_000)],
    }),
    invoice({
      id: 'sam-18', ownerId: 'sam', number: 'S-0018', clientName: 'Brightsale AB', issueDate: d(-5), dueDate: d(10), vatTreatment: 'exempt',
      lines: [base('s18-b', 'this half'), commission('s18-c', 'this half', 12_400_000)],
    }),
  ]

  const timeEntries: TimeEntry[] = [
    { id: 'te-1', ownerId: 'alex', projectId: null, workDate: d(-8), minutes: 390, note: 'Legal contract EN→SV', invoiceId: null },
    { id: 'te-2', ownerId: 'alex', projectId: null, workDate: d(-7), minutes: 435, note: 'Legal contract EN→SV', invoiceId: null },
    { id: 'te-3', ownerId: 'alex', projectId: null, workDate: d(-5), minutes: 145, note: 'Terminology review', invoiceId: null },
    { id: 'te-4', ownerId: 'alex', projectId: null, workDate: d(-2), minutes: 300, note: 'Legal contract EN→SV', invoiceId: null },
  ]

  const expenses: Expense[] = [
    { id: 'ex-1', ownerId: 'alex', date: d(-19), supplier: 'Adobe', category: 'software', amountGross: 125_000, vatAmount: 25_000, currency: 'SEK', fxRateToSek: 1, deductiblePercent: 100, receiptPath: null, note: 'Acrobat Pro' },
    { id: 'ex-2', ownerId: 'alex', date: d(-12), supplier: 'Dustin', category: 'equipment', amountGross: 399_000, vatAmount: 79_800, currency: 'SEK', fxRateToSek: 1, deductiblePercent: 100, receiptPath: null, note: 'Monitor' },
    { id: 'ex-3', ownerId: 'sam', date: d(-16), supplier: 'Telia', category: 'phone', amountGross: 49_900, vatAmount: 9_980, currency: 'SEK', fxRateToSek: 1, deductiblePercent: 50, receiptPath: null, note: 'Mobile, half business' },
  ]

  return { people, invoices: [...history, ...current], timeEntries, expenses, deductions: [] }
}
