import { useState, type ReactNode } from 'react'
import { useToday } from '../../app/context'
import { NumberInput } from '../../components/NumberInput'
import { Button, Card, Field, Notice, PageLoading, inputClass } from '../../components/ui'
import { yearOf } from '../../domain/dates'
import type { Housing } from '../../domain/expense'
import {
  ACCOUNTING_METHOD_LABELS, VAT_PERIOD_LABELS, isValidOrgNumber, isValidSwedishVatNumber, vatNumberFromOrgNumber,
  type AccountingMethod, type Person, type VatPeriod,
} from '../../domain/person'
import { CURRENCIES, type Currency } from '../../domain/money'
import type { TaxYearParams } from '../../domain/tax/params'
import { usePeople, useSavePerson, useSaveTaxParams, useTaxParams } from '../../data/hooks'

export function SettingsPage() {
  const people = usePeople()
  const today = useToday()
  const params = useTaxParams(yearOf(today))
  if (!people.data || !params.data) return <PageLoading />
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Business details print on your invoices. Tax settings drive the estimates.</p>
      </div>
      {people.data.map((p) => <PersonForm key={p.id} person={p} />)}
      <TaxRatesForm key={params.data.year} params={params.data} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

function PersonForm({ person }: { person: Person }) {
  const save = useSavePerson()
  const [p, setP] = useState(person)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof Person>(key: K, value: Person[K]) => {
    setP((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }
  const text = (key: keyof Person) => ({ className: inputClass, value: String(p[key] ?? ''), onChange: (e: { target: { value: string } }) => set(key, e.target.value as never) })

  async function submit() {
    const next: Record<string, string> = {}
    if (!p.displayName.trim()) next.displayName = 'Add a name'
    if (p.orgNumber && !isValidOrgNumber(p.orgNumber)) next.orgNumber = 'Check the number: it should be 10 digits, e.g. 811218-9876'
    if (p.vatRegistered && p.vatNumber && !isValidSwedishVatNumber(p.vatNumber)) next.vatNumber = 'A Swedish VAT number looks like SE811218987601'
    if (!p.invoicePrefix.trim()) next.invoicePrefix = 'Add a prefix, e.g. A'
    if (!(p.nextInvoiceNumber >= 1)) next.nextInvoiceNumber = 'Must be 1 or more'
    setErrors(next)
    if (Object.keys(next).length) return
    await save.mutateAsync(p)
    setSaved(true)
  }

  return (
    <Card title={person.displayName}>
      <div className="space-y-8">
        <Section title="Business">
          <Field label="Name" error={errors.displayName}><input {...text('displayName')} /></Field>
          <Field label="Role"><input {...text('roleTitle')} /></Field>
          <Field label="Business name"><input {...text('businessName')} /></Field>
          <Field label="Org number (personnummer)" error={errors.orgNumber}><input {...text('orgNumber')} placeholder="811218-9876" /></Field>
          <Field label="Address" className="sm:col-span-2"><textarea rows={2} className={`${inputClass} h-auto py-2`} value={p.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="Email"><input {...text('email')} type="email" /></Field>
          <Field label="Phone"><input {...text('phone')} /></Field>
          <Field label="Colour"><input type="color" className="h-10 w-20 rounded-lg border border-line" value={p.color} onChange={(e) => set('color', e.target.value)} /></Field>
        </Section>

        <Section title="VAT (moms)">
          <label className="flex items-center gap-2 text-sm font-medium sm:pt-7">
            <input type="checkbox" className="h-4 w-4" checked={p.vatRegistered} onChange={(e) => set('vatRegistered', e.target.checked)} />
            VAT registered
          </label>
          {p.vatRegistered && (
            <>
              <Field label="VAT number" error={errors.vatNumber} hint={!p.vatNumber && p.orgNumber ? <button type="button" className="font-medium text-accent" onClick={() => set('vatNumber', vatNumberFromOrgNumber(p.orgNumber))}>Use {vatNumberFromOrgNumber(p.orgNumber)}</button> : undefined}>
                <input {...text('vatNumber')} placeholder="SE811218987601" />
              </Field>
              <Field label="VAT period">
                <select className={inputClass} value={p.vatPeriod} onChange={(e) => set('vatPeriod', e.target.value as VatPeriod)}>
                  {Object.entries(VAT_PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Accounting method">
            <select className={inputClass} value={p.accountingMethod} onChange={(e) => set('accountingMethod', e.target.value as AccountingMethod)}>
              {Object.entries(ACCOUNTING_METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="Tax">
          <Field label="Municipal tax (%)" hint="Kommunalskatt incl. region, e.g. 32.38"><NumberInput value={p.municipalRate} onValueChange={(v) => set('municipalRate', v)} /></Field>
          <Field label="Birth year"><NumberInput value={p.birthYear} onValueChange={(v) => set('birthYear', v)} /></Field>
          <Field label="F-skatt per month (kr)"><NumberInput value={p.monthlyFskatt} onValueChange={(v) => set('monthlyFskatt', v)} /></Field>
          <Field label="Salary from an employer (kr a year)" hint="Leave empty if the firm is your only income"><NumberInput value={p.employmentIncome} onValueChange={(v) => set('employmentIncome', v)} /></Field>
          <Field label="Housing" hint="Sets the home office deduction">
            <select className={inputClass} value={p.housing} onChange={(e) => set('housing', e.target.value as Housing)}>
              <option value="apartment">Rented or bostadsrätt</option>
              <option value="house">Own house</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium sm:pt-7">
            <input type="checkbox" className="h-4 w-4" checked={p.hasOccupationalPension} onChange={(e) => set('hasOccupationalPension', e.target.checked)} />
            Has a tjänstepension
          </label>
        </Section>

        <Section title="Invoices and payments">
          <Field label="Invoice prefix" error={errors.invoicePrefix}><input {...text('invoicePrefix')} /></Field>
          <Field label="Next invoice number" error={errors.nextInvoiceNumber} hint="Numbers follow on without gaps"><NumberInput value={p.nextInvoiceNumber} onValueChange={(v) => set('nextInvoiceNumber', Math.round(v))} /></Field>
          <Field label="Payment terms (days)"><NumberInput value={p.paymentTermsDays} onValueChange={(v) => set('paymentTermsDays', Math.round(v))} /></Field>
          <Field label="Usual client"><input {...text('defaultClientName')} /></Field>
          <Field label="Bankgiro"><input {...text('bankgiro')} /></Field>
          <Field label="IBAN"><input {...text('iban')} /></Field>
          <Field label="BIC"><input {...text('bic')} /></Field>
          <Field label="Usual invoice currency" hint="New invoices start in this currency">
            <select className={inputClass} value={p.defaultCurrency} onChange={(e) => set('defaultCurrency', e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {p.workStyle === 'hourly' ? (
            <Field label="Hourly rate (kr)" hint="Leave empty to type each invoice's total yourself"><NumberInput scale={100} value={p.hourlyRate} onValueChange={(v) => set('hourlyRate', v)} /></Field>
          ) : (
            <Field label={`Base fee per half month (${p.defaultCurrency === 'SEK' ? 'kr' : p.defaultCurrency})`} hint="The commission amount is typed on each invoice">
              <NumberInput scale={100} value={p.baseFee} onValueChange={(v) => set('baseFee', v)} />
            </Field>
          )}
        </Section>

        {p.workStyle === 'base_commission' && (
          <Notice title="A note from your accountant">
            A fixed base fee from one main client can make Skatteverket ask whether the work is really employment. Keep your own business terms in writing, and use your own tools and other clients where you can.
          </Notice>
        )}

        <div className="flex items-center justify-end gap-3">
          {saved && <span role="status" className="text-sm text-success">Saved</span>}
          <Button variant="primary" onClick={submit} disabled={save.isPending}>Save {person.displayName}</Button>
        </div>
      </div>
    </Card>
  )
}

function TaxRatesForm({ params }: { params: TaxYearParams }) {
  const save = useSaveTaxParams()
  const [p, setP] = useState(params)
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof TaxYearParams>(key: K, value: TaxYearParams[K]) => {
    setP((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }
  const percent = (key: 'egenavgiftRate' | 'stateTaxRate' | 'specialPayrollTaxPension') => (
    <NumberInput value={Number((p[key] * 100).toFixed(4))} onValueChange={(v) => set(key, v / 100)} />
  )

  return (
    <Card title={`Tax rates ${params.year}`}>
      <p className="mb-4 text-sm text-muted">Check these against Skatteverket every January (Belopp och procent). They're used for every estimate.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Prisbasbelopp (kr)"><NumberInput value={p.pbb} onValueChange={(v) => set('pbb', v)} /></Field>
        <Field label="Inkomstbasbelopp (kr)"><NumberInput value={p.ibb} onValueChange={(v) => set('ibb', v)} /></Field>
        <Field label="State tax threshold (skiktgräns, kr)"><NumberInput value={p.stateTaxThreshold} onValueChange={(v) => set('stateTaxThreshold', v)} /></Field>
        <Field label="Egenavgifter (%)">{percent('egenavgiftRate')}</Field>
        <Field label="State tax (%)">{percent('stateTaxRate')}</Field>
        <Field label="Särskild löneskatt on pension (%)">{percent('specialPayrollTaxPension')}</Field>
        <Field label="VAT exemption limit (kr)"><NumberInput value={p.vatExemptionThreshold} onValueChange={(v) => set('vatExemptionThreshold', v)} /></Field>
        <Field label="Mileage (kr per mil)"><NumberInput value={p.mileagePerMil} onValueChange={(v) => set('mileagePerMil', v)} /></Field>
        <Field label="Home office, own house (kr)"><NumberInput value={p.homeOfficeHouse} onValueChange={(v) => set('homeOfficeHouse', v)} /></Field>
        <Field label="Home office, apartment (kr)"><NumberInput value={p.homeOfficeApartment} onValueChange={(v) => set('homeOfficeApartment', v)} /></Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span role="status" className="text-sm text-success">Saved</span>}
        <Button variant="primary" onClick={async () => { await save.mutateAsync(p); setSaved(true) }} disabled={save.isPending}>Save rates</Button>
      </div>
    </Card>
  )
}
