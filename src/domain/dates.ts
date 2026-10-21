/** ISO calendar date, `YYYY-MM-DD`. All domain dates use this form, in UTC. */
export type IsoDate = string

const DAY_MS = 86_400_000

export function parseIso(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

export function todayIso(): IsoDate {
  const now = new Date()
  return toIso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(new Date(parseIso(date).getTime() + days * DAY_MS))
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / DAY_MS)
}

export function monthKey(date: IsoDate): string {
  return date.slice(0, 7)
}

export function formatDayLabel(date: IsoDate): string {
  return parseIso(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace(',', '')
}

export function formatShortDate(date: IsoDate): string {
  return parseIso(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Moves a Saturday or Sunday to the following Monday (Swedish public holidays are not handled). */
export function nextWeekday(date: IsoDate): IsoDate {
  const day = parseIso(date).getUTCDay()
  if (day === 6) return addDays(date, 2)
  if (day === 0) return addDays(date, 1)
  return date
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4))
}

/** Share of the calendar year that has passed, counting `date` itself. */
export function dayOfYearFraction(date: IsoDate): number {
  const year = yearOf(date)
  const dayOfYear = daysBetween(`${year}-01-01`, date) + 1
  const daysInYear = daysBetween(`${year}-01-01`, `${year + 1}-01-01`)
  return dayOfYear / daysInYear
}
