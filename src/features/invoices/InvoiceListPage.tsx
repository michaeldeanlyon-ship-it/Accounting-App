import { Link } from 'react-router-dom'
import { useToday } from '../../app/context'
import { Card, EmptyState, PageLoading, StatusPill } from '../../components/ui'
import { formatShortDate } from '../../domain/dates'
import { formatDuration } from '../../domain/duration'
import { invoiceStatus, invoiceTotals } from '../../domain/invoice'
import { formatMoney } from '../../domain/money'
import { useInvoices } from '../../data/hooks'
import { usePerson } from '../people/usePerson'

export function InvoiceListPage() {
  const person = usePerson()
  const today = useToday()
  const invoices = useInvoices()
  if (!invoices.data) return <PageLoading />

  const mine = invoices.data
    .filter((i) => i.ownerId === person.id)
    .sort((a, b) => Number(b.status === 'draft') - Number(a.status === 'draft') || b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number))

  if (mine.length === 0) {
    return <EmptyState title="Create your first invoice" body="Use New invoice above. You can edit every line before you send it." />
  }

  return (
    <Card>
      <div className="-mx-5 -my-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Number</th>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Issued</th>
              <th className="px-3 py-3 font-medium">Due</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-5 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {mine.map((invoice) => {
              const totals = invoiceTotals(invoice)
              return (
                <tr key={invoice.id} className="hover:bg-canvas">
                  <td className="px-5 py-3 font-medium">
                    <Link to={invoice.id} className="text-ink hover:text-accent">{invoice.number || 'Draft'}</Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link to={invoice.id} className="text-ink hover:text-accent">{invoice.clientName || 'No client yet'}</Link>
                    {totals.totalMinutes > 0 && <span className="block text-xs text-muted">{formatDuration(totals.totalMinutes)}</span>}
                  </td>
                  <td className="px-3 py-3 text-muted">{formatShortDate(invoice.issueDate)}</td>
                  <td className="px-3 py-3 text-muted">{formatShortDate(invoice.dueDate)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">{formatMoney(totals.gross)}</td>
                  <td className="px-5 py-3 text-right"><StatusPill status={invoiceStatus(invoice, today)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
