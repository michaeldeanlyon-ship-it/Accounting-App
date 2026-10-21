import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, PageLoading } from '../../components/ui'
import { useInvoices, usePeople } from '../../data/hooks'
import { NotFoundPage } from '../NotFoundPage'
import { InvoiceDocument } from './InvoiceDocument'

/** Bare page for printing or "Save as PDF" from the browser's print dialog. */
export function InvoicePrintPage() {
  const { invoiceId } = useParams()
  const invoices = useInvoices()
  const people = usePeople()
  const invoice = invoices.data?.find((i) => i.id === invoiceId)
  const person = people.data?.find((p) => p.id === invoice?.ownerId)

  useEffect(() => {
    if (!invoice || !person) return
    document.title = `${invoice.number || 'Draft invoice'} · ${invoice.clientName}`
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [invoice, person])

  if (!invoices.data || !people.data) return <PageLoading />
  if (!invoice || !person) return <NotFoundPage />

  return (
    <div className="min-h-screen bg-canvas py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-between px-4">
        <Link to={`/people/${person.id}/invoices/${invoice.id}`} className="text-sm font-medium text-accent hover:underline">← Back to the invoice</Link>
        <Button variant="primary" onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <InvoiceDocument invoice={invoice} person={person} />
    </div>
  )
}
