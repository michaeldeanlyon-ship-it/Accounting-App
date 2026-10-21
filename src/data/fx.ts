import type { IsoDate } from '../domain/dates'
import type { Currency } from '../domain/money'

/** Riksbank rate (SEK per unit) for the invoice date, via the /api/fx-rate Vercel function. */
export async function fetchRateToSek(currency: Currency, date: IsoDate): Promise<number> {
  if (currency === 'SEK') return 1
  const response = await fetch(`/api/fx-rate?currency=${currency}&date=${date}`)
  if (!response.ok) throw new Error('Could not fetch the exchange rate. Enter it by hand.')
  const body = (await response.json()) as { rate?: number }
  if (!body.rate || !(body.rate > 0)) throw new Error('No exchange rate found for that date. Enter it by hand.')
  return body.rate
}
