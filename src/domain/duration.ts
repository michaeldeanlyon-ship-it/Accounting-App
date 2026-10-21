import { multiplyMoney, type Money } from './money'

/** Hour dropdown values for one working day. */
export const HOUR_OPTIONS: readonly number[] = Array.from({ length: 25 }, (_, h) => h)
/** Minute dropdown values, in 5-minute steps. */
export const MINUTE_OPTIONS: readonly number[] = Array.from({ length: 12 }, (_, i) => i * 5)

export const MAX_DAY_MINUTES = 24 * 60

export function toMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes
}

export function splitMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

export function formatDuration(total: number): string {
  const { hours, minutes } = splitMinutes(Math.round(total))
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

/** Returns an error message, or null when the day's time is valid. */
export function validateDayMinutes(total: number): string | null {
  if (!(total > 0)) return 'Pick at least 5 minutes'
  if (total > MAX_DAY_MINUTES) return 'A day can have at most 24 h 00 min'
  return null
}

export function amountForMinutes(minutes: number, hourlyRate: Money): Money {
  return multiplyMoney(hourlyRate, minutes / 60)
}
