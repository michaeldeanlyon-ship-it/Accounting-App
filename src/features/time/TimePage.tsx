import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToday } from '../../app/context'
import { DurationPicker } from '../../components/DurationPicker'
import { Button, Card, EmptyState, Field, PageLoading, inputClass } from '../../components/ui'
import { formatDayLabel } from '../../domain/dates'
import { amountForMinutes, formatDuration, validateDayMinutes } from '../../domain/duration'
import { formatMoney, money } from '../../domain/money'
import { unbilledSummary, type TimeEntry } from '../../domain/timesheet'
import { useCreateInvoice, useDeleteTimeEntry, useInvoices, useSaveTimeEntry, useTimeEntries } from '../../data/hooks'
import { usePerson } from '../people/usePerson'

export function TimePage() {
  const person = usePerson()
  const entries = useTimeEntries()
  const invoices = useInvoices()
  const createInvoice = useCreateInvoice()
  const navigate = useNavigate()

  if (!entries.data || !invoices.data) return <PageLoading />
  const mine = entries.data.filter((e) => e.ownerId === person.id).sort((a, b) => b.workDate.localeCompare(a.workDate))
  const rate = money(person.hourlyRate, 'SEK')
  const summary = unbilledSummary(mine, rate)
  const numbers = new Map(invoices.data.map((i) => [i.id, i]))

  async function invoiceUnbilled() {
    const saved = await createInvoice.mutateAsync(person)
    navigate(`/people/${person.id}/invoices/${saved.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
        <div>
          <p className="text-sm text-muted">Not invoiced yet</p>
          <p data-testid="unbilled-summary" className="text-2xl font-semibold tabular-nums">
            {formatDuration(summary.minutes)}
            {person.hourlyRate > 0 && <span className="text-base font-normal text-muted"> = {formatMoney(summary.amount, { decimals: 0 })} excl. moms</span>}
          </p>
          <p className="text-xs text-muted">
            {person.hourlyRate > 0
              ? `At ${formatMoney(rate, { decimals: 0 })} an hour. Change the rate in Settings.`
              : 'The days and their time go on the invoice; you type the total amount there.'}
          </p>
        </div>
        {summary.count > 0 && (
          <Button variant="primary" onClick={invoiceUnbilled} disabled={createInvoice.isPending}>
            Create invoice from {summary.count} unbilled {summary.count === 1 ? 'day' : 'days'}
          </Button>
        )}
      </div>

      <LogDayForm ownerId={person.id} />

      <Card title="Time log" labelledBy="time-log-heading">
        {mine.length === 0 ? (
          <EmptyState title="Log your first day" body="Pick the hours and minutes you worked. Days are put on an invoice when you're ready." />
        ) : (
          <ul aria-labelledby="time-log-heading" className="divide-y divide-line">
            {mine.map((entry) => (
              <TimeRow key={entry.id} entry={entry} rate={person.hourlyRate} invoiceNumber={entry.invoiceId ? (numbers.get(entry.invoiceId)?.number || 'a draft') : null} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function LogDayForm({ ownerId }: { ownerId: string }) {
  const today = useToday()
  const save = useSaveTimeEntry()
  const [workDate, setWorkDate] = useState(today)
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(8 * 60)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = !workDate ? 'Pick a date' : !note.trim() ? 'Add a short description first' : validateDayMinutes(minutes)
    setError(problem)
    if (problem) return
    try {
      await save.mutateAsync({ id: '', ownerId, projectId: null, workDate, minutes, note: note.trim(), invoiceId: null })
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form aria-label="Log a day" onSubmit={submit} noValidate className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">Log a day</h2>
      <div className="grid items-end gap-4 sm:grid-cols-[10rem_1fr_auto_auto]">
        <Field label="Date">
          <input type="date" className={inputClass} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        </Field>
        <Field label="What you did">
          <input className={inputClass} value={note} onChange={(e) => { setNote(e.target.value); setError(null) }} placeholder="Proofreading chapter 4" />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium">Time</span>
          <DurationPicker minutes={minutes} onChange={(m) => { setMinutes(m); setError(null) }} />
        </div>
        <Button type="submit" variant="primary" disabled={save.isPending}>Add day</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  )
}

function TimeRow({ entry, rate, invoiceNumber }: { entry: TimeEntry; rate: number; invoiceNumber: string | null }) {
  const save = useSaveTimeEntry()
  const remove = useDeleteTimeEntry()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry)
  const [error, setError] = useState<string | null>(null)

  async function commit() {
    const problem = !draft.note.trim() ? 'Add a short description first' : validateDayMinutes(draft.minutes)
    setError(problem)
    if (problem) return
    await save.mutateAsync(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="space-y-2 py-3">
        <div className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_auto_auto]">
          <Field label="Date"><input type="date" className={inputClass} value={draft.workDate} onChange={(e) => setDraft({ ...draft, workDate: e.target.value })} /></Field>
          <Field label="What you did"><input className={inputClass} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
          <DurationPicker minutes={draft.minutes} onChange={(minutes) => setDraft({ ...draft, minutes })} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={commit} disabled={save.isPending}>Save</Button>
            <Button variant="ghost" onClick={() => { setDraft(entry); setEditing(false) }}>Cancel</Button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
      <span className="w-28 font-medium">{formatDayLabel(entry.workDate)}</span>
      <span className="min-w-0 flex-1">{entry.note}</span>
      <span className="w-24 text-right font-semibold tabular-nums">{formatDuration(entry.minutes)}</span>
      {rate > 0 && <span className="w-24 text-right tabular-nums text-muted">{formatMoney(amountForMinutes(entry.minutes, money(rate, 'SEK')), { decimals: 0 })}</span>}
      <span className="w-36 text-right">
        {invoiceNumber ? (
          <Link to={`../invoices/${entry.invoiceId}`} className="text-xs font-medium text-accent hover:underline">On {invoiceNumber}</Link>
        ) : (
          <span className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="ghost" aria-label={`Delete ${formatDayLabel(entry.workDate)}`} onClick={() => remove.mutate(entry.id)}>Delete</Button>
          </span>
        )}
      </span>
    </li>
  )
}
