import type { IsoDate } from '../../domain/dates'
import { dueDateFromTerms, salesInvoiceLines, salesPeriodFor, timeLinesFromEntries, type Invoice, type InvoiceLine } from '../../domain/invoice'
import type { Person } from '../../domain/person'
import type { TimeEntry } from '../../domain/timesheet'

/**
 * A ready-to-edit draft for a person.
 * - Hourly work: one line per unbilled day. With an hourly rate the days are priced; without one the days
 *   only show the time and a "Translation services" line holds the total amount.
 * - Base fee + commission: both as amounts, in the person's usual currency.
 */
export function buildNewInvoice(person: Person, options: { today: IsoDate; unbilled: readonly TimeEntry[]; fxRateToSek?: number }): {
  invoice: Invoice
  timeEntryIds: string[]
} {
  const { today } = options
  const vatRate = person.vatRegistered ? 25 : 0
  const currency = person.defaultCurrency
  let lines: InvoiceLine[]
  let timeEntryIds: string[] = []

  if (person.workStyle === 'base_commission') {
    lines = salesInvoiceLines({ baseFee: person.baseFee, periodLabel: salesPeriodFor(today).label, vatRate })
  } else {
    const rate = person.hourlyRate > 0 ? person.hourlyRate : null
    const unbilled = options.unbilled.filter((e) => e.ownerId === person.id && e.invoiceId === null)
    timeEntryIds = [...unbilled].sort((a, b) => a.workDate.localeCompare(b.workDate)).map((e) => e.id)
    lines = unbilled.length
      ? timeLinesFromEntries(unbilled, rate, vatRate)
      : [{ id: crypto.randomUUID(), kind: 'time', description: '', workDate: today, minutes: 0, hourlyRate: rate, vatRate }]
    if (rate === null) {
      lines.push({ id: crypto.randomUUID(), kind: 'fixed', description: 'Translation services', quantity: 1, unit: 'st', unitPrice: 0, vatRate })
    }
  }

  return {
    timeEntryIds,
    invoice: {
      id: '',
      ownerId: person.id,
      number: '',
      clientId: null,
      clientName: person.defaultClientName,
      issueDate: today,
      dueDate: dueDateFromTerms(today, person.paymentTermsDays),
      currency,
      fxRateToSek: currency === 'SEK' ? 1 : (options.fxRateToSek ?? 1),
      vatTreatment: person.vatRegistered ? 'domestic' : 'exempt',
      status: 'draft',
      paidDate: null,
      paidAmount: null,
      paidAmountSek: null,
      creditsInvoiceId: null,
      notes: '',
      lines,
    },
  }
}
