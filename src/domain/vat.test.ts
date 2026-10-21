import { describe, expect, it } from 'vitest'
import { effectiveVatRate, suggestVatTreatment, legalNotes, isEuCountry, VAT_TREATMENT_LABELS, allowedVatTreatments, countsTowardsVatLimit } from './vat'

describe('vat', () => {
  it('charges the line rate only for domestic sales', () => {
    expect(effectiveVatRate('domestic', 25)).toBe(25)
    expect(effectiveVatRate('domestic', 6)).toBe(6)
    expect(effectiveVatRate('eu_reverse_charge', 25)).toBe(0)
    expect(effectiveVatRate('export', 25)).toBe(0)
    expect(effectiveVatRate('exempt', 25)).toBe(0)
  })

  it('knows EU member states and that Sweden is one', () => {
    expect(isEuCountry('DE')).toBe(true)
    expect(isEuCountry('SE')).toBe(true)
    expect(isEuCountry('NO')).toBe(false)
    expect(isEuCountry('GB')).toBe(false)
  })

  it('suggests momsbefriad for a seller who is not VAT registered', () => {
    expect(suggestVatTreatment({ sellerVatRegistered: false, clientCountry: 'SE', clientIsBusiness: true })).toBe('exempt')
  })

  it('suggests Swedish VAT for Swedish clients (no domestic reverse charge for these services)', () => {
    expect(suggestVatTreatment({ sellerVatRegistered: true, clientCountry: 'SE', clientIsBusiness: true })).toBe('domestic')
  })

  it('suggests reverse charge for EU business clients but Swedish VAT for EU consumers', () => {
    expect(suggestVatTreatment({ sellerVatRegistered: true, clientCountry: 'DE', clientIsBusiness: true })).toBe('eu_reverse_charge')
    expect(suggestVatTreatment({ sellerVatRegistered: true, clientCountry: 'DE', clientIsBusiness: false })).toBe('domestic')
  })

  it('suggests export (no Swedish VAT) for business clients outside the EU', () => {
    expect(suggestVatTreatment({ sellerVatRegistered: true, clientCountry: 'US', clientIsBusiness: true })).toBe('export')
  })

  it('always prints Godkänd för F-skatt', () => {
    for (const t of ['domestic', 'eu_reverse_charge', 'export', 'exempt'] as const) {
      expect(legalNotes(t)).toContain('Godkänd för F-skatt')
    }
  })

  it('adds the reverse charge wording required on EU invoices', () => {
    expect(legalNotes('eu_reverse_charge').join(' ')).toMatch(/Omvänd betalningsskyldighet/)
    expect(legalNotes('eu_reverse_charge').join(' ')).toMatch(/Reverse charge/)
  })

  it('adds the exemption wording for a seller who is not VAT registered', () => {
    expect(legalNotes('exempt').join(' ')).toMatch(/Momsbefriad/)
  })

  it('has a friendly label for every treatment', () => {
    expect(VAT_TREATMENT_LABELS.domestic).toBe('Sweden: moms charged')
  })
})

describe('VAT choices per seller', () => {
  it('lets a VAT-registered seller charge moms, reverse charge or sell outside the EU', () => {
    expect(allowedVatTreatments(true)).toEqual(['domestic', 'eu_reverse_charge', 'export'])
  })

  it('lets a seller who is not registered be momsbefriad or sell outside Sweden', () => {
    expect(allowedVatTreatments(false)).toEqual(['exempt', 'export'])
  })

  it('says which sales are taxed in Sweden and count towards the VAT limit', () => {
    expect(countsTowardsVatLimit('exempt')).toBe(true)
    expect(countsTowardsVatLimit('domestic')).toBe(true)
    expect(countsTowardsVatLimit('export')).toBe(false)
    expect(countsTowardsVatLimit('eu_reverse_charge')).toBe(false)
  })
})
