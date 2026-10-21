export const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK'] as const
export type Currency = (typeof CURRENCIES)[number]

/** An amount in minor units (öre, cents) plus its currency. Never a float. */
export interface Money {
  readonly amount: number
  readonly currency: Currency
}

export function money(amount: number, currency: Currency): Money {
  if (!Number.isInteger(amount)) throw new Error(`Money amount must be an integer number of minor units, got ${amount}`)
  return { amount, currency }
}

export const ZERO_SEK: Money = money(0, 'SEK')

/** Rounds half away from zero, the usual rule for öre on Swedish invoices. */
export function roundHalfAwayFromZero(value: number): number {
  const rounded = Math.round(Math.abs(value) + Number.EPSILON * Math.abs(value))
  return value < 0 ? -rounded : rounded
}

export function fromMajor(major: number, currency: Currency): Money {
  // toFixed first strips binary noise such as 1.005 * 100 = 100.49999…
  return money(roundHalfAwayFromZero(Number((major * 100).toFixed(6))), currency)
}

export function toMajor(m: Money): number {
  return m.amount / 100
}

function assertSameCurrency(a: Money, b: Money) {
  if (a.currency !== b.currency) throw new Error(`Cannot combine different currencies: ${a.currency} and ${b.currency}`)
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

export function sumMoney(items: readonly Money[], currency: Currency): Money {
  return items.reduce((total, m) => addMoney(total, m), money(0, currency))
}

export function multiplyMoney(m: Money, factor: number): Money {
  return money(roundHalfAwayFromZero(Number((m.amount * factor).toFixed(6))), m.currency)
}

export function percentOf(m: Money, percent: number): Money {
  return multiplyMoney(m, percent / 100)
}

export function negate(m: Money): Money {
  return money(m.amount === 0 ? 0 : -m.amount, m.currency)
}

export function convertToSek(m: Money, rateToSek: number): Money {
  if (!(rateToSek > 0)) throw new Error(`Exchange rate must be positive, got ${rateToSek}`)
  if (m.currency === 'SEK') return m
  return money(roundHalfAwayFromZero(Number((m.amount * rateToSek).toFixed(6))), 'SEK')
}

export function formatMoney(m: Money, options: { decimals?: 0 | 2 } = {}): string {
  const decimals = options.decimals ?? 2
  const major = toMajor(m)
  const text =
    m.currency === 'SEK'
      ? `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(major)} kr`
      : new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: m.currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(major)
  // Intl uses non-breaking spaces and a typographic minus; normalise for predictable display.
  return text.replace(/[  ]/g, ' ').replace(/−/g, '-')
}
