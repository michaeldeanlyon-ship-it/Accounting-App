// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleFxRequest, riksbankRate } from './fx-rate.ts'

const observations = (rows: { date: string; value: number }[]) =>
  vi.fn(async (_input: string) => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } }))

describe('riksbankRate', () => {
  it('returns the rate published on the date', async () => {
    const fetchImpl = observations([{ date: '2026-10-19', value: 11.41 }, { date: '2026-10-20', value: 11.45 }])
    expect(await riksbankRate('EUR', '2026-10-20', fetchImpl)).toEqual({ rate: 11.45, date: '2026-10-20' })
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/Observations/SEKEURPMI/2026-10-10/2026-10-20')
  })

  it('falls back to the previous banking day on weekends', async () => {
    const fetchImpl = observations([{ date: '2026-10-16', value: 11.39 }])
    expect(await riksbankRate('EUR', '2026-10-18', fetchImpl)).toEqual({ rate: 11.39, date: '2026-10-16' })
  })

  it('rejects currencies it does not know', async () => {
    await expect(riksbankRate('XYZ', '2026-10-20', observations([]))).rejects.toThrow(/Unsupported currency/)
  })

  it('fails clearly when the Riksbank has no rate', async () => {
    await expect(riksbankRate('USD', '2026-10-20', observations([]))).rejects.toThrow(/No rate/)
  })
})

describe('GET /api/fx-rate', () => {
  it('answers with JSON and caches the result', async () => {
    const response = await handleFxRequest(new Request('https://x.test/api/fx-rate?currency=EUR&date=2026-10-20'), observations([{ date: '2026-10-20', value: 11.45 }]))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ currency: 'EUR', rate: 11.45, date: '2026-10-20' })
    expect(response.headers.get('cache-control')).toContain('s-maxage')
  })

  it('returns 400 for a bad request', async () => {
    const response = await handleFxRequest(new Request('https://x.test/api/fx-rate?currency=EUR&date=yesterday'), observations([]))
    expect(response.status).toBe(400)
  })
})
