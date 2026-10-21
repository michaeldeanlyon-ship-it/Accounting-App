import { useState } from 'react'
import { useToday } from '../../app/context'
import { NumberInput } from '../../components/NumberInput'
import { Card, Field, Kpi, Notice, PageLoading } from '../../components/ui'
import { turnoverForYear } from '../../domain/dashboard'
import { formatShortDate, yearOf } from '../../domain/dates'
import { momsDueDate } from '../../domain/deadlines'
import { formatMoney, money } from '../../domain/money'
import type { Person } from '../../domain/person'
import { taxSuggestions } from '../../domain/tax/suggestions'
import { vatPeriodRange, vatReport } from '../../domain/vatReport'
import { useDeductions, useExpenses, useInvoices, useTaxParams } from '../../data/hooks'
import { usePerson } from '../people/usePerson'
import { personTaxSummary } from './taxModel'

const kr = (kronor: number) => formatMoney(money(Math.round(kronor) * 100, 'SEK'), { decimals: 0 })

export function TaxPage() {
  const person = usePerson()
  const today = useToday()
  const year = yearOf(today)
  const invoices = useInvoices()
  const expenses = useExpenses()
  const deductions = useDeductions()
  const params = useTaxParams(year)
  const [plan, setPlan] = useState({ periodiseringsfond: 0, pensionSaving: 0 })

  if (!invoices.data || !expenses.data || !deductions.data || !params.data) return <PageLoading />
  const sources = { person, invoices: invoices.data, expenses: expenses.data, deductions: deductions.data, params: params.data, today }
  const summary = personTaxSummary({ ...sources, plan })
  const baseline = personTaxSummary({ ...sources, plan: { periodiseringsfond: 0, pensionSaving: 0 } })
  const { estimate, ytd, advice } = summary
  const saving = baseline.estimate.total - estimate.total
  const suggestions = taxSuggestions({
    input: summary.input, vatRegistered: person.vatRegistered, turnoverThisYear: turnoverForYear(invoices.data, person.id, year),
    hasOccupationalPension: person.hasOccupationalPension, housing: person.housing, today, monthlyFskatt: person.monthlyFskatt,
  })

  const rows: [string, number][] = [
    ['Income excl. moms (projected)', summary.input.businessIncome],
    ['Costs (projected)', -summary.input.expenses],
    ['Home office, mileage and other deductions', -(summary.input.homeOffice + summary.input.mileage + summary.input.otherDeductions)],
    ...(estimate.pensionDeduction ? [['Pension saving', -estimate.pensionDeduction] as [string, number]] : []),
    ...(estimate.periodiseringsfond ? [['Periodiseringsfond', -estimate.periodiseringsfond] as [string, number]] : []),
    ['Profit (överskott)', estimate.profit],
    ['Egenavgifter', estimate.egenavgifter],
    ['Municipal tax (kommunalskatt)', estimate.municipalTax],
    ['State tax (statlig skatt)', estimate.stateTax],
    ['Jobbskatteavdrag', -estimate.jobbskatteavdrag],
    ...(estimate.specialPayrollTax ? [['Särskild löneskatt on pension', estimate.specialPayrollTax] as [string, number]] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tax {year}</h2>
        <p className="text-sm text-muted">An estimate for planning, based on {person.accountingMethod === 'cash' ? 'payments received' : 'invoices issued'} so far this year and projected to 31 December.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Profit so far" value={kr(ytd.income - ytd.expenses - ytd.homeOffice - ytd.mileage - ytd.otherDeductions)} hint={`Income ${kr(ytd.income)} minus costs and deductions`} />
        <Kpi label="Estimated tax for the year" hint="Egenavgifter plus income tax on the business">
          <p data-testid="estimated-total" className="mt-1 text-2xl font-semibold tabular-nums">{kr(estimate.total)}</p>
        </Kpi>
        <Kpi label="F-skatt paid so far" value={kr(summary.fSkattPaid)} hint={`${kr(person.monthlyFskatt)} a month`} />
        <Kpi label="Not covered by F-skatt" value={kr(advice.shortfall)} tone={advice.shortfall > 0 ? 'warning' : 'success'} hint={`Estimate minus 12 × ${kr(person.monthlyFskatt)}. Set this aside.`} />
      </div>

      {advice.shortfall > 0 ? (
        <Notice tone="warning" title={`F-skatt is about ${kr(advice.shortfall)} short for the year`}>
          Raise your preliminary tax to about {kr(advice.suggestedMonthly)} a month (ändrad preliminär inkomstdeklaration on skatteverket.se), or set the difference aside and pay it before 12 February to avoid interest.
        </Notice>
      ) : (
        <Notice tone="success" title="Your F-skatt covers the estimate">You're on track. Check again after big invoices.</Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Plan before year end">
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="pf" className="text-sm font-medium">Periodiseringsfond</label>
                <span className="text-sm font-semibold tabular-nums">{kr(estimate.periodiseringsfond)}</span>
              </div>
              <input
                id="pf"
                type="range"
                min={0}
                max={Math.max(0, estimate.periodiseringsfondMax)}
                step={1000}
                value={Math.min(plan.periodiseringsfond, estimate.periodiseringsfondMax)}
                onChange={(e) => setPlan({ ...plan, periodiseringsfond: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--color-accent)]"
              />
              <p className="text-xs text-muted">Up to {kr(estimate.periodiseringsfondMax)}. The tax is deferred for up to 6 years, not cancelled.</p>
            </div>
            {!person.hasOccupationalPension && (
              <Field label="Private pension saving (kr)" hint={`Deductible up to ${kr(estimate.pensionMax)}. 24.26% särskild löneskatt applies.`}>
                <NumberInput value={plan.pensionSaving} onValueChange={(v) => setPlan({ ...plan, pensionSaving: Math.max(0, v) })} placeholder="0" />
              </Field>
            )}
            {saving > 0 && <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">These choices lower this year's tax by about {kr(saving)}.</p>}
          </div>
        </Card>

        <Card title="How the estimate is made">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className={label.startsWith('Profit') ? 'font-semibold' : 'text-muted'}>{label}</dt>
                <dd className={`text-right tabular-nums ${label.startsWith('Profit') ? 'font-semibold' : ''}`}>{kr(value)}</dd>
              </div>
            ))}
            <dt className="border-t border-line pt-1.5 font-semibold">Estimated tax</dt>
            <dd className="border-t border-line pt-1.5 text-right font-semibold tabular-nums">{kr(estimate.total)}</dd>
          </dl>
        </Card>
      </div>

      <Card title="Ways to lower your tax" labelledBy="suggestions-heading">
        <ul aria-labelledby="suggestions-heading" className="divide-y divide-line">
          {suggestions.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={`font-medium ${s.severity === 'warning' ? 'text-warning' : 'text-ink'}`}>{s.title}</p>
                {s.saving > 0 && <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Saves about {kr(s.saving)} this year</span>}
              </div>
              <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      {person.vatRegistered && <VatCard person={person} />}

      <p className="text-xs text-muted">
        Estimates use the {year} rates in Settings and simplify some rules (for example räntefördelning and public service fee). They help you plan; the final tax is set by Skatteverket from your inkomstdeklaration with NE-bilaga.
      </p>
    </div>
  )
}

function VatCard({ person }: { person: Person }) {
  const today = useToday()
  const invoices = useInvoices()
  const expenses = useExpenses()
  if (!invoices.data || !expenses.data) return null
  const period = vatPeriodRange(person.vatPeriod, today)
  const report = vatReport({ invoices: invoices.data, expenses: expenses.data, ownerId: person.id, period, method: person.accountingMethod })
  const hasEu = invoices.data.some((i) => i.ownerId === person.id && i.vatTreatment === 'eu_reverse_charge')
  const due = momsDueDate(person.vatPeriod, period.year, period.index, hasEu)

  return (
    <Card title={`Moms ${period.label}`}>
      <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-muted">Sales in Sweden excl. moms (ruta 05)</dt><dd className="text-right tabular-nums">{kr(report.domesticSales)}</dd>
        <dt className="text-muted">Output moms (utgående moms)</dt><dd className="text-right tabular-nums">{kr(report.outputVat)}</dd>
        <dt className="text-muted">Services to EU businesses (ruta 39)</dt><dd className="text-right tabular-nums">{kr(report.euServiceSales)}</dd>
        <dt className="text-muted">Services outside the EU (ruta 40)</dt><dd className="text-right tabular-nums">{kr(report.exportSales)}</dd>
        <dt className="text-muted">Input moms (ingående moms, ruta 48)</dt><dd className="text-right tabular-nums">−{kr(report.inputVat)}</dd>
        <dt className="border-t border-line pt-1.5 font-semibold">{report.toPay >= 0 ? 'To pay' : 'To get back'}</dt>
        <dd className="border-t border-line pt-1.5 text-right font-semibold tabular-nums">{kr(Math.abs(report.toPay))}</dd>
      </dl>
      <p className="mt-3 text-sm text-muted">So far this period. Return and payment due {formatShortDate(due)} {due.slice(0, 4)}.</p>
    </Card>
  )
}
