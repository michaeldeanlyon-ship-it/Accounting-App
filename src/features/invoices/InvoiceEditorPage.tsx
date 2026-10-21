import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToday } from '../../app/context'
import { DurationPicker } from '../../components/DurationPicker'
import { NumberInput } from '../../components/NumberInput'
import { Button, Card, Field, Notice, PageLoading, StatusPill, inputClass } from '../../components/ui'
import { formatDayLabel, formatShortDate } from '../../domain/dates'
import { formatDuration } from '../../domain/duration'
import { invoiceStatus, invoiceTotals, lineNet, validateForSending, type Invoice, type InvoiceLine } from '../../domain/invoice'
import { CURRENCIES, formatMoney, type Currency } from '../../domain/money'
import type { Person } from '../../domain/person'
import { legalNotes, VAT_RATES, VAT_TREATMENT_LABELS, VAT_TREATMENTS, type VatTreatment } from '../../domain/vat'
import { fetchRateToSek } from '../../data/fx'
import { useAuditLog, useCreditInvoice, useDeleteDraft, useInvoices, useSaveInvoice, useSendInvoice, useSetPaid } from '../../data/hooks'
import { NotFoundPage } from '../NotFoundPage'
import { usePerson } from '../people/usePerson'
import { InvoiceDocument } from './InvoiceDocument'

export function InvoiceEditorPage() {
  const { invoiceId } = useParams()
  const person = usePerson()
  const invoices = useInvoices()
  if (!invoices.data) return <PageLoading />
  const invoice = invoices.data.find((i) => i.id === invoiceId && i.ownerId === person.id)
  if (!invoice) return <NotFoundPage />
  const clientNames = [...new Set(invoices.data.filter((i) => i.ownerId === person.id && i.clientName).map((i) => i.clientName))]
  return <InvoiceEditor key={invoice.id} invoice={invoice} person={person} clientNames={clientNames} />
}

function InvoiceEditor({ invoice, person, clientNames }: { invoice: Invoice; person: Person; clientNames: string[] }) {
  const today = useToday()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(invoice)
  const [saved, setSaved] = useState(invoice)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [preview, setPreview] = useState(false)
  const [paidDate, setPaidDate] = useState(today)
  const save = useSaveInvoice()
  const send = useSendInvoice()
  const remove = useDeleteDraft()
  const setPaid = useSetPaid()
  const credit = useCreditInvoice()
  const audit = useAuditLog(saved.id, saved.status !== 'draft')

  const status = invoiceStatus(draft, today)
  const totals = invoiceTotals(draft)
  const isDraft = saved.status === 'draft'
  const isCredit = draft.creditsInvoiceId !== null
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const vatRate = person.vatRegistered ? 25 : 0
  const busy = save.isPending || send.isPending || setPaid.isPending || credit.isPending || remove.isPending

  const update = (patch: Partial<Invoice>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setMessage(null)
  }
  const updateLine = (id: string, patch: Partial<InvoiceLine>) =>
    update({ lines: draft.lines.map((l) => (l.id === id ? ({ ...l, ...patch } as InvoiceLine) : l)) })
  const addLine = (line: InvoiceLine) => update({ lines: [...draft.lines, line] })

  const fail = (error: unknown) => setErrors([error instanceof Error ? error.message : String(error)])

  async function persist(): Promise<Invoice> {
    const result = await save.mutateAsync({ invoice: draft, previous: saved })
    setDraft(result)
    setSaved(result)
    return result
  }

  async function onSave() {
    setErrors([])
    try {
      await persist()
      setMessage('Saved')
    } catch (e) {
      fail(e)
    }
  }

  async function onSend() {
    const problems = validateForSending(draft)
    setErrors(problems)
    if (problems.length) return
    try {
      const stored = await persist()
      const sent = await send.mutateAsync(stored.id)
      setDraft(sent)
      setSaved(sent)
      setMessage(`Marked as sent with number ${sent.number}`)
    } catch (e) {
      fail(e)
    }
  }

  async function onPaid(paid: boolean) {
    setErrors([])
    try {
      const result = await setPaid.mutateAsync({ invoice: draft, paid, date: paidDate })
      setDraft(result)
      setSaved(result)
      setMessage(paid ? 'Marked as paid' : 'Marked as unpaid')
    } catch (e) {
      fail(e)
    }
  }

  async function onCredit() {
    try {
      const note = await credit.mutateAsync(saved)
      navigate(`/people/${person.id}/invoices/${note.id}`)
    } catch (e) {
      fail(e)
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(saved.id)
      navigate(`/people/${person.id}/invoices`)
    } catch (e) {
      fail(e)
    }
  }

  async function onFetchRate() {
    try {
      update({ fxRateToSek: await fetchRateToSek(draft.currency, draft.issueDate) })
    } catch (e) {
      fail(e)
    }
  }

  const title = isDraft ? 'Draft invoice' : isCredit ? `Credit note ${saved.number}` : `Invoice ${saved.number}`
  const treatments = VAT_TREATMENTS.filter((t) => t !== 'exempt')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/people/${person.id}/invoices`} className="text-sm font-medium text-accent hover:underline">← Invoices</Link>
          <h2 className="text-xl font-semibold">{title}</h2>
          <StatusPill status={status} testId="invoice-status" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPreview((p) => !p)} aria-pressed={preview}>Preview</Button>
          <Link to={`/invoices/${saved.id}/print`} className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-canvas">
            Print or save as PDF
          </Link>
        </div>
      </div>

      {saved.status === 'credited' && <Notice tone="warning" title="Cancelled by a credit note">This invoice has been credited in full. Nothing more is owed on it.</Notice>}
      {!isDraft && saved.status !== 'credited' && (
        <Notice>This invoice has been sent. You can still edit it, and every change is saved in the change history below.</Notice>
      )}
      {errors.length > 0 && (
        <Notice tone="danger" title="Check the invoice">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Notice>
      )}
      {message && !dirty && <Notice tone="success">{message}</Notice>}

      <Card title="Client and dates">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client" className="sm:col-span-2">
            <input className={inputClass} list="client-names" value={draft.clientName} onChange={(e) => update({ clientName: e.target.value })} placeholder="Nordic Lingua AB" />
            <datalist id="client-names">{clientNames.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="Invoice date">
            <input type="date" className={inputClass} value={draft.issueDate} onChange={(e) => update({ issueDate: e.target.value })} />
          </Field>
          <Field label="Due date" hint={`Your usual terms: ${person.paymentTermsDays} days`}>
            <input type="date" className={inputClass} value={draft.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
          </Field>
          <Field label="Client address" className="sm:col-span-2">
            <textarea rows={2} className={`${inputClass} h-auto py-2`} value={draft.clientAddress ?? ''} onChange={(e) => update({ clientAddress: e.target.value })} />
          </Field>
          <Field label="Client org number">
            <input className={inputClass} value={draft.clientOrgNumber ?? ''} onChange={(e) => update({ clientOrgNumber: e.target.value })} />
          </Field>
          <Field label="Client VAT number" hint={draft.vatTreatment === 'eu_reverse_charge' ? 'Required for reverse charge' : undefined}>
            <input className={inputClass} value={draft.clientVatNumber ?? ''} onChange={(e) => update({ clientVatNumber: e.target.value })} />
          </Field>
          <Field label="Currency">
            <select className={inputClass} value={draft.currency} onChange={(e) => update({ currency: e.target.value as Currency, fxRateToSek: e.target.value === 'SEK' ? 1 : draft.fxRateToSek })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {draft.currency !== 'SEK' && (
            <Field label={`Exchange rate (SEK per 1 ${draft.currency})`} hint={<button type="button" className="font-medium text-accent hover:underline" onClick={onFetchRate}>Get the Riksbank rate</button>}>
              <NumberInput value={draft.fxRateToSek} onValueChange={(v) => update({ fxRateToSek: v || 1 })} />
            </Field>
          )}
          <Field label="VAT (moms)" className="sm:col-span-2">
            {person.vatRegistered ? (
              <select className={inputClass} value={draft.vatTreatment} onChange={(e) => update({ vatTreatment: e.target.value as VatTreatment })}>
                {treatments.map((t) => <option key={t} value={t}>{VAT_TREATMENT_LABELS[t]}</option>)}
              </select>
            ) : (
              <p className="flex h-10 items-center text-sm text-muted">No VAT (momsbefriad). Turn on VAT in Settings if you register.</p>
            )}
          </Field>
        </div>
      </Card>

      <Card title="Lines">
        <div className="space-y-3">
          {draft.lines.map((line, index) => (
            <LineEditor
              key={line.id}
              line={line}
              index={index}
              currency={draft.currency}
              showVat={draft.vatTreatment === 'domestic'}
              onChange={(patch) => updateLine(line.id, patch)}
              onRemove={() => update({ lines: draft.lines.filter((l) => l.id !== line.id) })}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {person.workStyle === 'hourly' && (
            <Button size="sm" onClick={() => addLine({ id: crypto.randomUUID(), kind: 'time', description: `${formatDayLabel(today)} · `, workDate: today, minutes: 0, hourlyRate: person.hourlyRate, vatRate })}>
              + Add day
            </Button>
          )}
          <Button size="sm" onClick={() => addLine({ id: crypto.randomUUID(), kind: 'fixed', description: '', quantity: 1, unit: 'st', unitPrice: 0, vatRate })}>+ Add item</Button>
          {person.workStyle === 'base_commission' && (
            <Button size="sm" onClick={() => addLine({ id: crypto.randomUUID(), kind: 'commission', description: 'Commission', salesBase: 0, percent: person.commissionPercent || 5, vatRate })}>
              + Add commission
            </Button>
          )}
        </div>

        <dl className="ml-auto mt-6 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 border-t border-line pt-4 text-sm">
          {totals.totalMinutes !== 0 && (
            <><dt className="text-muted">Total time</dt><dd data-testid="total-time" className="text-right font-medium">{formatDuration(Math.abs(totals.totalMinutes))}</dd></>
          )}
          <dt className="text-muted">Net amount</dt><dd className="text-right tabular-nums">{formatMoney(totals.net)}</dd>
          {totals.vatGroups.map((g) => (
            <div key={g.rate} className="contents"><dt className="text-muted">Moms {g.rate}%</dt><dd className="text-right tabular-nums">{formatMoney(g.vat)}</dd></div>
          ))}
          <dt className="text-base font-semibold">Total to pay</dt>
          <dd data-testid="total-gross" className="text-right text-base font-semibold tabular-nums">{formatMoney(totals.gross)}</dd>
          {draft.currency !== 'SEK' && (<><dt className="text-muted">In SEK</dt><dd className="text-right tabular-nums text-muted">{formatMoney(totals.grossSek)}</dd></>)}
        </dl>
        <ul className="mt-4 space-y-0.5 text-xs text-muted">{legalNotes(draft.vatTreatment).map((n) => <li key={n}>{n}</li>)}</ul>
      </Card>

      <Card>
        <Field label="Notes" hint="Printed on the invoice, for example a purchase order number.">
          <textarea rows={3} className={`${inputClass} h-auto py-2`} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            confirmDelete ? (
              <>
                <span className="self-center text-sm">Delete this draft?</span>
                <Button variant="danger" onClick={onDelete} disabled={busy}>Yes, delete</Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete draft</Button>
            )
          ) : (
            !isCredit && saved.status !== 'credited' && <Button variant="danger" onClick={onCredit} disabled={busy}>Create credit note</Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isDraft && saved.status !== 'credited' && (
            saved.paidDate ? (
              <>
                <span className="text-sm text-success">Paid {formatShortDate(saved.paidDate)}</span>
                <Button onClick={() => onPaid(false)} disabled={busy}>Mark as unpaid</Button>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted">
                  Paid on
                  <input type="date" aria-label="Payment date" className={`${inputClass} w-40`} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                </label>
                <Button onClick={() => onPaid(true)} disabled={busy}>Mark as paid</Button>
              </>
            )
          )}
          {isDraft ? (
            <>
              <Button onClick={onSave} disabled={busy}>Save draft</Button>
              <Button variant="primary" onClick={onSend} disabled={busy}>Save and mark as sent</Button>
            </>
          ) : (
            <Button variant="primary" onClick={onSave} disabled={busy || !dirty}>Save changes</Button>
          )}
        </div>
      </div>

      {preview && <InvoiceDocument invoice={draft} person={person} label="Invoice preview" />}

      {!isDraft && (
        <Card title="Change history">
          {audit.data && audit.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {audit.data.map((a) => (
                <li key={a.id} className="flex justify-between gap-4">
                  <span>{a.summary}</span>
                  <span className="text-muted">{new Date(a.changedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{a.changedBy ? ` · ${a.changedBy}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No changes since it was sent.</p>
          )}
        </Card>
      )}
    </div>
  )
}

function LineEditor({ line, index, currency, showVat, onChange, onRemove }: {
  line: InvoiceLine
  index: number
  currency: Currency
  showVat: boolean
  onChange: (patch: Partial<InvoiceLine>) => void
  onRemove: () => void
}) {
  const unit = currency === 'SEK' ? 'kr' : currency
  return (
    <div role="group" aria-label={`Line ${index + 1}`} className="rounded-lg border border-line p-3">
      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-12">
        <Field label="Description" className="col-span-2 md:col-span-4">
          <input className={inputClass} value={line.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="What you did" />
        </Field>

        {line.kind === 'time' && (
          <>
            <Field label="Date" className="md:col-span-2">
              <input type="date" className={inputClass} value={line.workDate} onChange={(e) => onChange({ workDate: e.target.value })} />
            </Field>
            <div className="md:col-span-3">
              <span className="mb-1 block text-sm font-medium">Time</span>
              <DurationPicker compact minutes={line.minutes} onChange={(minutes) => onChange({ minutes })} />
            </div>
            <Field label={`Rate (${unit}/h)`} className="md:col-span-1">
              <NumberInput scale={100} value={line.hourlyRate} onValueChange={(hourlyRate) => onChange({ hourlyRate })} />
            </Field>
          </>
        )}

        {line.kind === 'fixed' && (
          <>
            <Field label="Quantity" className="md:col-span-2">
              <NumberInput value={line.quantity} onValueChange={(quantity) => onChange({ quantity })} />
            </Field>
            <Field label="Unit" className="md:col-span-1">
              <input className={inputClass} value={line.unit} onChange={(e) => onChange({ unit: e.target.value })} />
            </Field>
            <Field label={`Unit price (${unit})`} className="md:col-span-3">
              <NumberInput scale={100} value={line.unitPrice} onValueChange={(unitPrice) => onChange({ unitPrice })} />
            </Field>
          </>
        )}

        {line.kind === 'commission' && (
          <>
            <Field label={`Sales amount (${unit})`} className="md:col-span-4">
              <NumberInput scale={100} value={line.salesBase} onValueChange={(salesBase) => onChange({ salesBase })} />
            </Field>
            <Field label="Commission %" className="md:col-span-2">
              <NumberInput value={line.percent} onValueChange={(percent) => onChange({ percent })} />
            </Field>
          </>
        )}

        <div className={`flex items-end justify-between gap-2 ${showVat ? 'md:col-span-2' : 'md:col-span-2'} col-span-2`}>
          {showVat && (
            <Field label="Moms" className="w-20">
              <select className={inputClass} value={line.vatRate} onChange={(e) => onChange({ vatRate: Number(e.target.value) })}>
                {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
          )}
          <span data-testid="line-total" className="flex h-10 flex-1 items-center justify-end font-semibold tabular-nums">{formatMoney(lineNet(line, currency))}</span>
          <button type="button" aria-label={`Remove line ${index + 1}`} onClick={onRemove} className="flex h-10 w-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
