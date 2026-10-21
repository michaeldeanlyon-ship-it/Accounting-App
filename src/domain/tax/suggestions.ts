import { parseIso, type IsoDate } from '../dates'
import { homeOfficeDeduction, type Housing } from '../expense'
import { formatMoney, money } from '../money'
import { estimateTax, fSkattAdvice, type TaxInput } from './estimate'
import { directDeductionLimit } from './params'

export interface SuggestionContext {
  /** Full-year figures (projected if the year is not over). */
  input: TaxInput
  vatRegistered: boolean
  /** Net sales this year, whole kronor. */
  turnoverThisYear: number
  hasOccupationalPension: boolean
  housing: Housing
  today: IsoDate
  monthlyFskatt: number
}

export interface Suggestion {
  id: string
  severity: 'warning' | 'tip'
  title: string
  detail: string
  /** Estimated tax saved this year, whole kronor. 0 for reminders. */
  saving: number
}

const kr = (amount: number) => formatMoney(money(Math.round(amount) * 100, 'SEK'), { decimals: 0 })

export function taxSuggestions(ctx: SuggestionContext): Suggestion[] {
  const { input } = ctx
  const params = input.params
  const now = estimateTax(input)
  const savingWith = (change: Partial<TaxInput>) => Math.max(0, now.total - estimateTax({ ...input, ...change }).total)
  const list: Suggestion[] = []

  const advice = fSkattAdvice({ estimatedAnnualTax: now.total, monthlyFskatt: ctx.monthlyFskatt, today: ctx.today })
  if (advice.shortfall > 0) {
    list.push({
      id: 'f_skatt', severity: 'warning', saving: 0,
      title: `F-skatt is about ${kr(advice.shortfall)} short this year`,
      detail: `Ask Skatteverket to raise your preliminary tax to about ${kr(advice.suggestedMonthly)} a month (ändrad preliminär inkomstdeklaration), or set the money aside. Paying before 12 February avoids interest (kostnadsränta).`,
    })
  }

  if (!ctx.vatRegistered) {
    const limit = params.vatExemptionThreshold
    if (ctx.turnoverThisYear >= limit) {
      list.push({
        id: 'vat_registration', severity: 'warning', saving: 0,
        title: `You have passed ${kr(limit)}: register for VAT now`,
        detail: 'Sales above the limit mean you must register for moms with Skatteverket and charge VAT from the sale that passed it.',
      })
    } else if (ctx.turnoverThisYear >= limit * 0.75) {
      list.push({
        id: 'vat_registration', severity: 'warning', saving: 0,
        title: `Approaching the VAT limit (${kr(ctx.turnoverThisYear)} of ${kr(limit)})`,
        detail: 'Plan ahead: once sales pass the limit you must register for moms and add VAT to invoices.',
      })
    }
  }

  const pfRoom = now.periodiseringsfondMax - now.periodiseringsfond
  if (pfRoom >= 1_000) {
    list.push({
      id: 'periodiseringsfond', severity: 'tip', saving: savingWith({ periodiseringsfond: now.periodiseringsfondMax }),
      title: `Set aside ${kr(now.periodiseringsfondMax)} in a periodiseringsfond`,
      detail: 'Up to 30% of profit can be moved to later years (within 6 years). The tax is deferred, not cancelled, so it evens out good and bad years.',
    })
  }

  const pensionRoom = now.pensionMax - now.pensionDeduction
  if (!ctx.hasOccupationalPension && pensionRoom >= 1_000) {
    list.push({
      id: 'pension', severity: 'tip', saving: savingWith({ pensionSaving: now.pensionMax }),
      title: `Deduct private pension saving, up to ${kr(now.pensionMax)}`,
      detail: `Without a tjänstepension you can deduct pension saving up to 35% of profit. Särskild löneskatt of ${Math.round(params.specialPayrollTaxPension * 10000) / 100}% applies, which is usually less than the tax saved.`,
    })
  }

  if (input.homeOffice === 0) {
    const amount = homeOfficeDeduction(ctx.housing, params)
    list.push({
      id: 'home_office', severity: 'tip', saving: savingWith({ homeOffice: amount }),
      title: `Claim the home office deduction, ${kr(amount)}`,
      detail: 'Allowed when you work at least 800 hours a year from home (schablonavdrag för bostad).',
    })
  }

  if (now.stateTax > 0) {
    list.push({
      id: 'expansionsfond', severity: 'tip', saving: 0,
      title: 'Consider an expansionsfond',
      detail: `Profit left in the business is taxed at ${Math.round(params.expansionsfondRate * 1000) / 10}% instead of your marginal rate with state tax. Talk it through before year end.`,
    })
  }

  if (input.mileage === 0) {
    list.push({
      id: 'mileage', severity: 'tip', saving: 0,
      title: 'Log business trips in your own car',
      detail: `You can deduct ${params.mileagePerMil} kr per mil (10 km) for business driving. Keep a simple log with date, purpose and distance.`,
    })
  }

  if (parseIso(ctx.today).getUTCMonth() >= 9) {
    list.push({
      id: 'equipment', severity: 'tip', saving: 0,
      title: 'Buy needed equipment before 31 December',
      detail: `Equipment under ${kr(directDeductionLimit(params))} excluding moms can be deducted in full this year instead of being depreciated.`,
    })
  }

  if (ctx.vatRegistered) {
    list.push({
      id: 'input_vat', severity: 'tip', saving: 0,
      title: 'Reclaim the moms on your business costs',
      detail: 'Add every receipt with its moms amount. Ingående moms reduces what you pay on the moms return.',
    })
  }

  const rank = (s: Suggestion) => (s.severity === 'warning' ? 0 : 1)
  return list.sort((a, b) => rank(a) - rank(b) || b.saving - a.saving)
}
