import type { IsoDate } from './dates'
import { amountForMinutes } from './duration'
import { sumMoney, type Money } from './money'

export interface TimeEntry {
  id: string
  ownerId: string
  projectId: string | null
  workDate: IsoDate
  /** Whole minutes worked that day, from the hour and minute dropdowns. */
  minutes: number
  note: string
  /** Null until the day is put on an invoice. */
  invoiceId: string | null
}

export function unbilledEntries(entries: readonly TimeEntry[]): TimeEntry[] {
  return entries.filter((e) => e.invoiceId === null)
}

export function unbilledSummary(entries: readonly TimeEntry[], hourlyRate: Money) {
  const open = unbilledEntries(entries)
  const minutes = open.reduce((sum, e) => sum + e.minutes, 0)
  return {
    minutes,
    amount: sumMoney(open.map((e) => amountForMinutes(e.minutes, hourlyRate)), hourlyRate.currency),
    count: open.length,
  }
}

export function billEntries(entries: readonly TimeEntry[], ids: readonly string[], invoiceId: string): TimeEntry[] {
  const wanted = new Set(ids)
  const alreadyBilled = entries.filter((e) => wanted.has(e.id) && e.invoiceId !== null)
  if (alreadyBilled.length) {
    throw new Error(`${alreadyBilled.map((e) => e.workDate).join(', ')} is already on an invoice`)
  }
  return entries.map((e) => (wanted.has(e.id) ? { ...e, invoiceId } : e))
}

export function releaseEntries(entries: readonly TimeEntry[], invoiceId: string): TimeEntry[] {
  return entries.map((e) => (e.invoiceId === invoiceId ? { ...e, invoiceId: null } : e))
}
