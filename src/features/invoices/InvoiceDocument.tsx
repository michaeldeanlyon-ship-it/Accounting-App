import { formatShortDate } from '../../domain/dates'
import { formatDuration } from '../../domain/duration'
import { invoiceTotals, lineDetail, lineNet, type Invoice } from '../../domain/invoice'
import { formatMoney } from '../../domain/money'
import type { Person } from '../../domain/person'
import { legalNotes } from '../../domain/vat'

/** The invoice as the client sees it, with the details Swedish invoices must carry. */
export function InvoiceDocument({ invoice, person, label = 'Invoice' }: { invoice: Invoice; person: Person; label?: string }) {
  const totals = invoiceTotals(invoice)
  const isCredit = invoice.creditsInvoiceId !== null
  const showVat = invoice.vatTreatment === 'domestic'

  return (
    <article aria-label={label} className="invoice-document mx-auto max-w-3xl rounded-xl border border-line bg-white p-8 text-sm text-ink print:border-0 print:p-0">
      <header className="flex flex-wrap justify-between gap-6">
        <div>
          <p className="text-lg font-semibold">{person.businessName || person.displayName}</p>
          {person.address && <p className="whitespace-pre-line text-muted">{person.address}</p>}
          <p className="text-muted">Org nr {person.orgNumber || '—'}</p>
          {person.vatRegistered && <p className="text-muted">VAT nr {person.vatNumber || '—'}</p>}
          {person.email && <p className="text-muted">{person.email}</p>}
          {person.phone && <p className="text-muted">{person.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{isCredit ? 'Kreditfaktura / Credit note' : 'Faktura / Invoice'}</p>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5">
            <dt className="text-muted">Number</dt><dd className="font-medium">{invoice.number || 'Draft'}</dd>
            <dt className="text-muted">Invoice date</dt><dd>{invoice.issueDate}</dd>
            <dt className="text-muted">Due date</dt><dd>{invoice.dueDate}</dd>
          </dl>
        </div>
      </header>

      <section className="mt-8">
        <p className="text-xs uppercase tracking-wide text-muted">Bill to</p>
        <p className="font-medium">{invoice.clientName || '(client)'}</p>
        {invoice.clientAddress && <p className="whitespace-pre-line text-muted">{invoice.clientAddress}</p>}
        {invoice.clientOrgNumber && <p className="text-muted">Org nr {invoice.clientOrgNumber}</p>}
        {invoice.clientVatNumber && <p className="text-muted">VAT nr {invoice.clientVatNumber}</p>}
      </section>

      <table className="mt-8 w-full">
        <thead>
          <tr className="border-b border-ink/20 text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 font-medium">Description</th>
            {showVat && <th className="py-2 text-right font-medium">Moms</th>}
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id} className="border-b border-line align-top">
              <td className="py-2">
                <p>{line.description || '—'}</p>
                <p className="text-xs text-muted">{lineDetail(line, invoice.currency)}</p>
              </td>
              {showVat && <td className="py-2 text-right text-muted">{line.vatRate}%</td>}
              <td className="py-2 text-right tabular-nums">{formatMoney(lineNet(line, invoice.currency))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        {totals.totalMinutes !== 0 && (<><dt className="text-muted">Total time</dt><dd className="text-right">{formatDuration(Math.abs(totals.totalMinutes))}</dd></>)}
        <dt className="text-muted">Net amount</dt><dd className="text-right tabular-nums">{formatMoney(totals.net)}</dd>
        {totals.vatGroups.map((g) => (
          <div key={g.rate} className="contents">
            <dt className="text-muted">Moms {g.rate}% on {formatMoney(g.net)}</dt><dd className="text-right tabular-nums">{formatMoney(g.vat)}</dd>
          </div>
        ))}
        <dt className="border-t border-ink/20 pt-1 font-semibold">Total to pay</dt>
        <dd className="border-t border-ink/20 pt-1 text-right font-semibold tabular-nums">{formatMoney(totals.gross)}</dd>
        {invoice.currency !== 'SEK' && totals.vat.amount !== 0 && (
          <><dt className="text-muted">Moms in SEK (rate {invoice.fxRateToSek})</dt><dd className="text-right tabular-nums">{formatMoney(totals.vatSek)}</dd></>
        )}
      </dl>

      {invoice.notes && <p className="mt-6 whitespace-pre-line">{invoice.notes}</p>}

      <footer className="mt-8 space-y-1 border-t border-line pt-4 text-xs text-muted">
        {legalNotes(invoice.vatTreatment).map((note) => <p key={note}>{note}</p>)}
        <p className="pt-2 text-ink">
          {[person.bankgiro && `Bankgiro ${person.bankgiro}`, person.iban && `IBAN ${person.iban}`, person.bic && `BIC ${person.bic}`].filter(Boolean).join(' · ') || 'Add bank details in Settings'}
        </p>
        <p>Please pay by {formatShortDate(invoice.dueDate)} and quote {invoice.number || 'the invoice number'}.</p>
      </footer>
    </article>
  )
}
