import { useState, type FormEvent } from 'react'
import { useRepository, useToday } from '../../app/context'
import { NumberInput } from '../../components/NumberInput'
import { Button, Card, EmptyState, Field, PageLoading, inputClass } from '../../components/ui'
import { formatShortDate, yearOf } from '../../domain/dates'
import {
  DEDUCTION_LABELS, EXPENSE_CATEGORIES, deductibleCostSek, homeOfficeDeduction, mileageDeduction, reclaimableVatSek, vatFromGross,
  type Expense, type ExpenseCategory,
} from '../../domain/expense'
import { formatMoney, money, sumMoney } from '../../domain/money'
import type { Person } from '../../domain/person'
import { useDeductions, useDeleteDeduction, useDeleteExpense, useExpenses, useSaveDeduction, useSaveExpense, useTaxParams } from '../../data/hooks'
import { usePerson } from '../people/usePerson'

const wholeKr = (kronor: number) => formatMoney(money(Math.round(kronor) * 100, 'SEK'), { decimals: 0 })

export function ExpensesPage() {
  const person = usePerson()
  const today = useToday()
  const expenses = useExpenses()
  if (!expenses.data) return <PageLoading />
  const year = yearOf(today)
  const mine = expenses.data.filter((e) => e.ownerId === person.id).sort((a, b) => b.date.localeCompare(a.date))
  const thisYear = mine.filter((e) => yearOf(e.date) === year)
  const deductible = sumMoney(thisYear.map((e) => deductibleCostSek(e, person.vatRegistered)), 'SEK')
  const inputVat = sumMoney(thisYear.map((e) => reclaimableVatSek(e, person.vatRegistered)), 'SEK')

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-muted">Deductible costs {year}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(deductible, { decimals: 0 })}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-muted">Moms to reclaim (ingående moms) {year}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{person.vatRegistered ? formatMoney(inputVat, { decimals: 0 }) : '—'}</p>
          {!person.vatRegistered && <p className="text-xs text-muted">Not VAT registered, so moms is part of the cost.</p>}
        </div>
      </div>

      <AddExpenseForm person={person} />

      <Card title="Expenses" labelledBy="expenses-heading">
        {mine.length === 0 ? (
          <EmptyState title="Add your first expense" body="Software, equipment, phone, travel: keep the receipt and add it here." />
        ) : (
          <ul aria-labelledby="expenses-heading" className="divide-y divide-line">
            {mine.map((e) => <ExpenseRow key={e.id} expense={e} vatRegistered={person.vatRegistered} />)}
          </ul>
        )}
      </Card>

      <DeductionsCard person={person} year={year} />
    </div>
  )
}

function AddExpenseForm({ person }: { person: Person }) {
  const today = useToday()
  const save = useSaveExpense()
  const [date, setDate] = useState(today)
  const [supplier, setSupplier] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('software')
  const [gross, setGross] = useState(0)
  const [rate, setRate] = useState(25)
  const [share, setShare] = useState(100)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const vat = vatFromGross(gross, person.vatRegistered ? rate : 25)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = !supplier.trim() ? 'Add the supplier name' : !(gross > 0) ? 'Enter an amount above 0' : !(share >= 0 && share <= 100) ? 'Business share must be 0–100%' : null
    setError(problem)
    if (problem) return
    const expense: Expense = {
      id: '', ownerId: person.id, date, supplier: supplier.trim(), category, amountGross: gross, vatAmount: vat,
      currency: 'SEK', fxRateToSek: 1, deductiblePercent: share, receiptPath: null, note: '',
    }
    try {
      await save.mutateAsync({ expense, receipt })
      setSupplier('')
      setGross(0)
      setReceipt(null)
      setFormKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form aria-label="Add an expense" onSubmit={submit} noValidate className="rounded-xl border border-line bg-white p-5" key={formKey}>
      <h2 className="mb-4 text-base font-semibold">Add an expense</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Supplier"><input className={inputClass} value={supplier} onChange={(e) => { setSupplier(e.target.value); setError(null) }} placeholder="Adobe" /></Field>
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Amount incl. moms (kr)">
          <NumberInput scale={100} value={gross} onValueChange={(v) => { setGross(v); setError(null) }} placeholder="1250" />
        </Field>
        {person.vatRegistered && (
          <Field label="Moms rate" hint={`Moms ${formatMoney(money(vat, 'SEK'))}`}>
            <select className={inputClass} value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              {[25, 12, 6, 0].map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </Field>
        )}
        <Field label="Business share (%)" hint="Use 50 for a phone you also use privately">
          <NumberInput value={share} onValueChange={setShare} />
        </Field>
        <Field label="Receipt (photo or PDF)" className="sm:col-span-2">
          <input type="file" accept="image/*,application/pdf" className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
        </Field>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end"><Button type="submit" variant="primary" disabled={save.isPending}>Add expense</Button></div>
    </form>
  )
}

function ExpenseRow({ expense, vatRegistered }: { expense: Expense; vatRegistered: boolean }) {
  const repo = useRepository()
  const remove = useDeleteExpense()
  const save = useSaveExpense()

  async function openReceipt() {
    if (!expense.receiptPath) return
    const url = await repo.receiptUrl(expense.receiptPath)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
      <span className="w-16 text-muted">{formatShortDate(expense.date)}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{expense.supplier}</span>
        <span className="block text-xs text-muted">{EXPENSE_CATEGORIES[expense.category]}{expense.deductiblePercent < 100 ? ` · ${expense.deductiblePercent}% business` : ''}{expense.note ? ` · ${expense.note}` : ''}</span>
      </span>
      <span className="w-28 text-right font-semibold tabular-nums">{formatMoney(money(expense.amountGross, expense.currency))}</span>
      <span className="w-32 text-right text-xs text-muted">{vatRegistered ? `moms ${formatMoney(money(expense.vatAmount, expense.currency))}` : 'no moms reclaim'}</span>
      <span className="flex w-40 justify-end gap-1">
        {expense.receiptPath ? (
          <Button size="sm" variant="ghost" onClick={openReceipt}>Receipt</Button>
        ) : (
          <label className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-sm font-medium text-accent hover:bg-canvas">
            Add receipt
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && save.mutate({ expense, receipt: e.target.files[0] })} />
          </label>
        )}
        <Button size="sm" variant="ghost" aria-label={`Delete ${expense.supplier}`} onClick={() => remove.mutate(expense.id)}>Delete</Button>
      </span>
    </li>
  )
}

function DeductionsCard({ person, year }: { person: Person; year: number }) {
  const deductions = useDeductions()
  const params = useTaxParams(year)
  const save = useSaveDeduction()
  const remove = useDeleteDeduction()
  const [mil, setMil] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!deductions.data || !params.data) return null
  const mine = deductions.data.filter((d) => d.ownerId === person.id && d.year === year)
  const homeOffice = homeOfficeDeduction(person.housing, params.data)
  const hasHomeOffice = mine.some((d) => d.type === 'home_office')

  async function addTrip() {
    if (!(mil > 0)) {
      setError('Enter the distance in mil (1 mil = 10 km)')
      return
    }
    setError(null)
    await save.mutateAsync({ id: '', ownerId: person.id, year, type: 'mileage', amount: mileageDeduction(mil, params.data!), distanceMil: mil, note: note.trim() })
    setMil(0)
    setNote('')
  }

  return (
    <Card title="Deductions" labelledBy="deductions-heading">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Home office (schablonavdrag)</p>
          <p className="text-sm text-muted">If you work at least 800 hours a year from home you can deduct {wholeKr(homeOffice)} ({person.housing === 'house' ? 'own house' : 'rented or bostadsrätt'}).</p>
          {!hasHomeOffice && (
            <Button onClick={() => save.mutate({ id: '', ownerId: person.id, year, type: 'home_office', amount: homeOffice, note: '' })}>
              Claim home office ({wholeKr(homeOffice)})
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Business trips in your own car</p>
          <div className="grid items-end gap-3 sm:grid-cols-[7rem_1fr_auto]">
            <Field label="Mil driven"><NumberInput value={mil} onValueChange={setMil} placeholder="12" /></Field>
            <Field label="Trip"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Client meeting, Uppsala" /></Field>
            <Button onClick={addTrip}>Add trip</Button>
          </div>
          <p className="text-xs text-muted">{params.data.mileagePerMil} kr per mil (10 km).</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      </div>
      {mine.length > 0 && (
        <ul aria-labelledby="deductions-heading" className="mt-6 divide-y divide-line border-t border-line">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center gap-4 py-2.5 text-sm">
              <span className="flex-1">
                <span className="font-medium">{DEDUCTION_LABELS[d.type]}</span>
                {(d.note || d.distanceMil) && <span className="block text-xs text-muted">{[d.distanceMil ? `${d.distanceMil} mil` : '', d.note].filter(Boolean).join(' · ')}</span>}
              </span>
              <span className="font-semibold tabular-nums">{wholeKr(d.amount)}</span>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)} aria-label={`Remove ${DEDUCTION_LABELS[d.type]}`}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
