import type { IsoDate } from '../../domain/dates'
import { dueDateFromTerms, salesInvoiceLines, salesPeriodFor, timeLinesFromEntries, type Invoice, type InvoiceLine } from '../../domain/invoice'
import type { Person } from '../../domain/person'
import type { TimeEntry } from '../../domain/timesheet'

/** A ready-to-edit draft for a person: days of work for hourly work, base fee + commission for sales. */
export function buildNewInvoice(person: Person, options: { today: IsoDate; unbilled: readonly TimeEntry[] }): {
  invoice: Invoice
  timeEntryIds: string[]
} {
  const { today } = options
  const vatRate = person.vatRegistered ? 25 : 0
  let lines: InvoiceLine[]
  let timeEntryIds: string[] = []

  if (person.workStyle === 'base_commission') {
    lines = salesInvoiceLines({
      baseFee: person.baseFee,
      periodLabel: salesPeriodFor(today).label,
      commissionPercent: person.commissionPercent,
      vatRate,
    })
  } else {
    const unbilled = options.unbilled.filter((e) => e.ownerId === person.id && e.invoiceId === null)
    timeEntryIds = [...unbilled].sort((a, b) => a.workDate.localeCompare(b.workDate)).map((e) => e.id)
    lines = unbilled.length
      ? timeLinesFromEntries(unbilled, person.hourlyRate, vatRate)
      : [{ id: crypto.randomUUID(), kind: 'time', description: '', workDate: today, minutes: 0, hourlyRate: person.hourlyRate, vatRate }]
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
      currency: 'SEK',
      fxRateToSek: 1,
      vatTreatment: person.vatRegistered ? 'domestic' : 'exempt',
      status: 'draft',
      paidDate: null,
      paidAmount: null,
      creditsInvoiceId: null,
      notes: '',
      lines,
    },
  }
}
