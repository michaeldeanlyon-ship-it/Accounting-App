/**
 * Rates and limits for one income year. All amounts are whole kronor.
 *
 * VERIFY EVERY JANUARY against Skatteverket (skatteverket.se → "Belopp och procent").
 * The values are also editable in Settings and stored in the `tax_year_params` table.
 */
export interface TaxYearParams {
  year: number
  /** Prisbasbelopp. */
  pbb: number
  /** Inkomstbasbelopp. */
  ibb: number
  egenavgiftRate: number
  /** Only ålderspensionsavgift, for those who turned 65 before the start of the year. */
  egenavgiftRateSenior: number
  /** Nedsättning av egenavgifter: 7.5% of the base, capped. */
  egenavgiftReductionRate: number
  egenavgiftReductionMax: number
  /** Schablonavdrag for egenavgifter in the preliminary calculation. */
  schablonavdragRate: number
  stateTaxRate: number
  /** Skiktgräns: taxable income above this pays state tax. */
  stateTaxThreshold: number
  /** Jobbskatteavdrag bands and coefficients, in prisbasbelopp. */
  jobbskatteavdrag: { band1: number; band2: number; band3: number; base2: number; rate2: number; base3: number; rate3: number; max: number }
  periodiseringsfondRate: number
  pensionDeductionRate: number
  pensionDeductionMaxIbb: number
  /** Särskild löneskatt on pension savings deducted in the business. */
  specialPayrollTaxPension: number
  /** Schablonavdrag for working from home, 800+ hours a year: owned house / rented or bostadsrätt. */
  homeOfficeHouse: number
  homeOfficeApartment: number
  /** Own car used for business, per Swedish mil (10 km). */
  mileagePerMil: number
  /** Turnover limit for the VAT exemption (momsbefrielse). */
  vatExemptionThreshold: number
  expansionsfondRate: number
  defaultMunicipalRate: number
}

export const PARAMS_2026: TaxYearParams = {
  year: 2026,
  pbb: 59_200,
  ibb: 83_400,
  egenavgiftRate: 0.2897,
  egenavgiftRateSenior: 0.1021,
  egenavgiftReductionRate: 0.075,
  egenavgiftReductionMax: 15_000,
  schablonavdragRate: 0.25,
  stateTaxRate: 0.2,
  stateTaxThreshold: 643_000,
  jobbskatteavdrag: { band1: 0.91, band2: 3.24, band3: 8.08, base2: 0.91, rate2: 0.3874, base3: 1.813, rate3: 0.251, max: 3.027 },
  periodiseringsfondRate: 0.3,
  pensionDeductionRate: 0.35,
  pensionDeductionMaxIbb: 10,
  specialPayrollTaxPension: 0.2426,
  homeOfficeHouse: 2_000,
  homeOfficeApartment: 4_000,
  mileagePerMil: 25,
  vatExemptionThreshold: 120_000,
  expansionsfondRate: 0.206,
  defaultMunicipalRate: 32.38,
}

export const PARAMS_BY_YEAR: Record<number, TaxYearParams> = { 2026: PARAMS_2026 }

export function paramsForYear(year: number): TaxYearParams {
  if (PARAMS_BY_YEAR[year]) return PARAMS_BY_YEAR[year]
  const latest = Math.max(...Object.keys(PARAMS_BY_YEAR).map(Number))
  return PARAMS_BY_YEAR[latest]
}

/** Half a prisbasbelopp: equipment below this (ex moms) can be deducted in full at once. */
export function directDeductionLimit(params: TaxYearParams): number {
  return params.pbb / 2
}
