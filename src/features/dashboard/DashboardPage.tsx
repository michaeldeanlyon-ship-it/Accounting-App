import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToday } from '../../app/context'
import { Card, EmptyState, Kpi, Notice, PageLoading, PersonDot, StatusPill } from '../../components/ui'
import { cashInByMonth, dashboardKpis, incomingPayments, turnoverForYear, vatThresholdStatus } from '../../domain/dashboard'
import { addDays, formatShortDate, monthKey, parseIso, yearOf, type IsoDate } from '../../domain/dates'
import { upcomingDeadlines } from '../../domain/deadlines'
import { formatDuration } from '../../domain/duration'
import { invoiceTotals, receivedSek, type Invoice } from '../../domain/invoice'
import { formatMoney, money } from '../../domain/money'
import { useDeductions, useExpenses, useInvoices, usePeople, useSetPaid, useTaxParams } from '../../data/hooks'
import { personTaxSummary } from '../tax/taxModel'
import { CashChart } from './CashChart'

const kr = (ore: number) => formatMoney(money(ore, 'SEK'), { decimals: 0 })
const wholeKr = (kronor: number) => formatMoney(money(Math.round(kronor) * 100, 'SEK'), { decimals: 0 })

function monthWindow(today: IsoDate): string[] {
  const d = parseIso(today)
  return [-3, -2, -1, 0, 1, 2].map((offset) => {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1))
    return monthKey(date.toISOString().slice(0, 10))
  })
}

export function DashboardPage() {
  const today = useToday()
  const people = usePeople()
  const invoices = useInvoices()
  const expenses = useExpenses()
  const deductions = useDeductions()
  const params = useTaxParams(yearOf(today))
  const [filter, setFilter] = useState<string>('all')
  const [showOlder, setShowOlder] = useState(false)

  const loaded = people.data && invoices.data && expenses.data && deductions.data && params.data
  const heading = (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted">{parseIso(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
    </div>
  )
  if (!loaded) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">{heading}</div>
        <PageLoading />
      </div>
    )
  }

  const allPeople = people.data!
  const allInvoices = invoices.data!
  const owner = filter === 'all' ? undefined : filter
  const shownPeople = owner ? allPeople.filter((p) => p.id === owner) : allPeople
  const kpis = dashboardKpis(allInvoices, today, owner)
  const allRows = incomingPayments(allInvoices, today, owner)
  const recentSince = addDays(today, -30)
  const isOld = (r: (typeof allRows)[number]) => r.outstandingSek.amount <= 0 && (r.invoice.paidDate ?? '') < recentSince
  const olderCount = allRows.filter(isOld).length
  const rows = showOlder ? allRows : allRows.filter((r) => !isOld(r))
  const cash = cashInByMonth(owner ? allInvoices.filter((i) => i.ownerId === owner) : allInvoices, monthWindow(today))
  const byId = new Map(allPeople.map((p) => [p.id, p]))

  const taxToSetAside = shownPeople.map((person) => {
    const summary = personTaxSummary({
      person, invoices: allInvoices, expenses: expenses.data!, deductions: deductions.data!, params: params.data!, today,
      plan: { periodiseringsfond: 0, pensionSaving: 0 },
    })
    return { person, amount: summary.advice.shortfall }
  })

  const vatWarnings = shownPeople
    .filter((p) => !p.vatRegistered)
    .map((p) => ({ person: p, turnover: turnoverForYear(allInvoices, p.id, yearOf(today)) }))
    .map((w) => ({ ...w, status: vatThresholdStatus(w.turnover, params.data!.vatExemptionThreshold) }))
    .filter((w) => w.status.level !== 'ok')

  const deadlines = upcomingDeadlines({
    today,
    horizonDays: 100,
    people: shownPeople.map((p) => ({
      id: p.id, name: p.displayName, vatRegistered: p.vatRegistered, vatPeriod: p.vatPeriod,
      hasEuSales: allInvoices.some((i) => i.ownerId === p.id && i.vatTreatment === 'eu_reverse_charge'),
    })),
  }).slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {heading}
        <div className="inline-flex rounded-lg border border-line bg-white p-1" role="group" aria-label="Show">
          {[{ id: 'all', label: 'Both' }, ...allPeople.map((p) => ({ id: p.id, label: p.displayName }))].map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`h-8 rounded-md px-3 text-sm font-medium ${filter === f.id ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Expected in the next 30 days" value={kr(kpis.expected30.amount)} hint={kpis.dueSoonCount ? `${kpis.dueSoonCount} due within a week` : 'Unpaid invoices due soon'} />
        <Kpi label="Overdue" value={kr(kpis.overdue.amount)} tone={kpis.overdueCount ? 'danger' : 'neutral'} hint={kpis.overdueCount ? `${kpis.overdueCount} ${kpis.overdueCount === 1 ? 'invoice' : 'invoices'} past due date` : 'Nothing overdue'} />
        <Kpi label="Paid this month" value={kr(kpis.paidThisMonth.amount)} tone="success" hint="Money received, incl. moms" />
        <Kpi label="Tax to set aside" hint="Estimated tax this year that F-skatt won't cover">
          <ul className="mt-1 space-y-0.5">
            {taxToSetAside.map(({ person, amount }) => (
              <li key={person.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5"><PersonDot color={person.color} />{person.displayName}</span>
                <span className="font-semibold tabular-nums">{wholeKr(amount)}</span>
              </li>
            ))}
          </ul>
        </Kpi>
      </div>

      {vatWarnings.map(({ person, turnover, status }) => (
        <Notice key={person.id} tone={status.level === 'exceeded' ? 'danger' : 'warning'} title={status.level === 'exceeded' ? 'Register for VAT now' : 'Approaching the VAT limit'}>
          {person.displayName} has invoiced {wholeKr(turnover)} this year. The limit for not charging moms is {wholeKr(params.data!.vatExemptionThreshold)}.
          {status.level === 'exceeded' ? ' Register with Skatteverket and add moms from the sale that passed the limit.' : ' Plan for VAT registration before you pass it.'}
        </Notice>
      ))}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Incoming payments" className="lg:col-span-2" labelledBy="payments-heading">
          {rows.length === 0 ? (
            <EmptyState title="No invoices yet" body="Invoices you send show up here until they are paid." />
          ) : (
            <ul aria-labelledby="payments-heading" className="divide-y divide-line">
              {rows.map(({ invoice, status, outstandingSek }) => {
                const person = byId.get(invoice.ownerId)
                const totals = invoiceTotals(invoice)
                const paid = status === 'paid'
                return (
                  <li key={invoice.id} className="flex items-center gap-2 py-3 sm:gap-3">
                    <PersonDot color={person?.color ?? '#999'} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/people/${invoice.ownerId}/invoices/${invoice.id}`} className="block truncate font-medium text-ink hover:text-accent">
                        {invoice.clientName || 'No client'} · {invoice.number}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {person?.displayName} · {paid && invoice.paidDate ? `paid ${formatShortDate(invoice.paidDate)}` : `due ${formatShortDate(invoice.dueDate)}`}
                        {totals.totalMinutes > 0 && ` · ${formatDuration(totals.totalMinutes)}`}
                        {invoice.currency !== 'SEK' && ` · ${formatMoney(totals.gross)}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-right font-semibold tabular-nums sm:w-28">{kr(paid ? receivedSek(invoice).amount : outstandingSek.amount)}</span>
                    <span className="hidden w-20 text-right sm:block"><StatusPill status={status} testId="payment-status" /></span>
                    <PaidCheckbox invoice={invoice} paid={paid} />
                  </li>
                )
              })}
            </ul>
          )}
          {olderCount > 0 && (
            <button type="button" onClick={() => setShowOlder((s) => !s)} className="mt-3 text-sm font-medium text-accent hover:underline">
              {showOlder ? 'Hide older payments' : `Show older payments (${olderCount})`}
            </button>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Upcoming deadlines" labelledBy="deadlines-heading">
            <ul aria-labelledby="deadlines-heading" className="space-y-2.5">
              {deadlines.map((d) => (
                <li key={`${d.date}-${d.kind}-${d.ownerId ?? 'all'}-${d.label}`} className="flex gap-3 text-sm">
                  <span className="w-14 shrink-0 font-semibold tabular-nums">{formatShortDate(d.date)}</span>
                  <span className="text-muted">
                    <span className="text-ink">{d.label}</span>
                    {d.ownerId && byId.get(d.ownerId) && ` · ${byId.get(d.ownerId)!.displayName}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Money in by month">
            <CashChart months={cash} people={shownPeople} />
          </Card>
        </div>
      </div>
    </div>
  )
}

/** The one-click Paid tick. Shows the new state the moment it's clicked, until the save settles. */
function PaidCheckbox({ invoice, paid }: { invoice: Invoice; paid: boolean }) {
  const setPaid = useSetPaid()
  const [pending, setPending] = useState<boolean | null>(null)
  return (
    <label className="flex shrink-0 cursor-pointer items-center justify-end gap-1.5 text-sm text-muted sm:w-16">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--color-accent)]"
        aria-label={`Mark ${invoice.number} as paid`}
        checked={pending ?? paid}
        onChange={(e) => {
          setPending(e.target.checked)
          setPaid.mutate({ invoice, paid: e.target.checked }, { onSettled: () => setPending(null) })
        }}
      />
      <span aria-hidden="true">Paid</span>
    </label>
  )
}
