import type { TaxYearParams } from './params'

/** Round-number rates for tests, so they check the formulas rather than a specific year's figures. */
export const FIXTURE_PARAMS: TaxYearParams = {
  year: 2026,
  pbb: 50_000,
  ibb: 70_000,
  egenavgiftRate: 0.2897,
  egenavgiftRateSenior: 0.1021,
  egenavgiftReductionRate: 0.075,
  egenavgiftReductionMax: 15_000,
  schablonavdragRate: 0.25,
  stateTaxRate: 0.2,
  stateTaxThreshold: 600_000,
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
  defaultMunicipalRate: 30,
}
