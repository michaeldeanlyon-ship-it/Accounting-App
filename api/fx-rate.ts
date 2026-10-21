/**
 * GET /api/fx-rate?currency=EUR&date=2026-10-20
 * Riksbank mid rate (SEK per 1 unit) for the date, or the last banking day before it.
 * Source: Riksbank SWEA API, https://api.riksbank.se/swea/v1
 */

const SERIES: Record<string, string> = {
  EUR: 'SEKEURPMI',
  USD: 'SEKUSDPMI',
  GBP: 'SEKGBPPMI',
  NOK: 'SEKNOKPMI',
  DKK: 'SEKDKKPMI',
}

type FetchLike = (input: string) => Promise<Response>

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function riksbankRate(currency: string, date: string, fetchImpl: FetchLike = fetch): Promise<{ rate: number; date: string }> {
  const series = SERIES[currency.toUpperCase()]
  if (!series) throw new Error(`Unsupported currency ${currency}`)
  // Ten days back covers weekends and Swedish holidays.
  const url = `https://api.riksbank.se/swea/v1/Observations/${series}/${daysBefore(date, 10)}/${date}`
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`Riksbank answered ${response.status}`)
  const rows = (await response.json()) as { date: string; value: number }[]
  const latest = rows.filter((r) => r.date <= date && r.value > 0).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!latest) throw new Error(`No rate for ${currency} on or before ${date}`)
  return { rate: latest.value, date: latest.date }
}

export async function handleFxRequest(request: Request, fetchImpl: FetchLike = fetch): Promise<Response> {
  const params = new URL(request.url).searchParams
  const currency = (params.get('currency') ?? '').toUpperCase()
  const date = params.get('date') ?? ''
  if (!SERIES[currency] || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Use ?currency=EUR&date=YYYY-MM-DD' }, { status: 400 })
  }
  try {
    const result = await riksbankRate(currency, date, fetchImpl)
    return Response.json({ currency, ...result }, { headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 502 })
  }
}

export function GET(request: Request): Promise<Response> {
  return handleFxRequest(request)
}
