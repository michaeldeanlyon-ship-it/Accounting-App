/**
 * How VAT (moms) applies to an invoice.
 * - domestic: Swedish moms at the line rate. Domestic reverse charge does not cover translation or sales services.
 * - eu_reverse_charge: business client in another EU country; the buyer accounts for VAT.
 * - export: place of supply outside Sweden (client outside the EU); no Swedish VAT.
 * - exempt: seller is not VAT registered (momsbefriad, small business exemption).
 */
export type VatTreatment = 'domestic' | 'eu_reverse_charge' | 'export' | 'exempt'

export const VAT_TREATMENTS: readonly VatTreatment[] = ['domestic', 'eu_reverse_charge', 'export', 'exempt']

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  domestic: 'Sweden: moms charged',
  eu_reverse_charge: 'EU business: reverse charge',
  export: 'Outside the EU: no Swedish VAT',
  exempt: 'No VAT (momsbefriad)',
}

export const VAT_RATES = [25, 12, 6, 0] as const
export type VatRate = (typeof VAT_RATES)[number]

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
])

export function isEuCountry(countryCode: string): boolean {
  return EU_COUNTRIES.has(countryCode.toUpperCase())
}

/** The VAT choices that make sense for a seller. */
export function allowedVatTreatments(sellerVatRegistered: boolean): VatTreatment[] {
  return sellerVatRegistered ? ['domestic', 'eu_reverse_charge', 'export'] : ['exempt', 'export']
}

/**
 * Whether a sale is taxable in Sweden and so counts towards the 120,000 kr limit for not charging moms.
 * Services to businesses abroad have their place of supply outside Sweden and don't count.
 */
export function countsTowardsVatLimit(treatment: VatTreatment): boolean {
  return treatment === 'domestic' || treatment === 'exempt'
}

export function effectiveVatRate(treatment: VatTreatment, lineRate: number): number {
  return treatment === 'domestic' ? lineRate : 0
}

export function suggestVatTreatment(input: {
  sellerVatRegistered: boolean
  clientCountry: string
  clientIsBusiness: boolean
}): VatTreatment {
  if (!input.sellerVatRegistered) return 'exempt'
  const country = input.clientCountry.toUpperCase()
  if (country === 'SE') return 'domestic'
  if (isEuCountry(country)) return input.clientIsBusiness ? 'eu_reverse_charge' : 'domestic'
  return 'export'
}

/** Mandatory or customary notes printed on the invoice for the given treatment. */
export function legalNotes(treatment: VatTreatment): string[] {
  const notes = ['Godkänd för F-skatt']
  switch (treatment) {
    case 'eu_reverse_charge':
      notes.push('Omvänd betalningsskyldighet / Reverse charge, article 196 Council Directive 2006/112/EC')
      break
    case 'export':
      notes.push('Place of supply outside Sweden: no Swedish VAT (omsättning utomlands)')
      break
    case 'exempt':
      notes.push('Momsbefriad enligt 18 kap. mervärdesskattelagen (2023:200)')
      break
    case 'domestic':
      break
  }
  return notes
}
