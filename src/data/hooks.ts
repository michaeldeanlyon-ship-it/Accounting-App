import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useRepository, useToday } from '../app/context'
import { createCreditNote, markUnpaid, recordPayment, type Invoice } from '../domain/invoice'
import type { Deduction, Expense } from '../domain/expense'
import type { Person } from '../domain/person'
import type { TaxYearParams } from '../domain/tax/params'
import type { TimeEntry } from '../domain/timesheet'
import { buildNewInvoice } from '../features/invoices/newInvoice'
import { fetchRateToSek } from './fx'
import type { Repository } from './repository'

export const keys = {
  people: ['people'] as const,
  invoices: ['invoices'] as const,
  time: ['time'] as const,
  expenses: ['expenses'] as const,
  deductions: ['deductions'] as const,
  tax: (year: number) => ['tax', year] as const,
  audit: (invoiceId: string) => ['audit', invoiceId] as const,
}

export const usePeople = () => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.people, queryFn: () => repo.listPeople() })
}
export const useInvoices = () => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.invoices, queryFn: () => repo.listInvoices() })
}
export const useTimeEntries = () => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.time, queryFn: () => repo.listTimeEntries() })
}
export const useExpenses = () => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.expenses, queryFn: () => repo.listExpenses() })
}
export const useDeductions = () => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.deductions, queryFn: () => repo.listDeductions() })
}
export const useTaxParams = (year: number) => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.tax(year), queryFn: () => repo.getTaxParams(year) })
}
export const useAuditLog = (invoiceId: string, enabled: boolean) => {
  const repo = useRepository()
  return useQuery({ queryKey: keys.audit(invoiceId), queryFn: () => repo.listAuditLog(invoiceId), enabled })
}

function useRepoMutation<TArgs, TResult>(run: (repo: Repository, args: TArgs) => Promise<TResult>, invalidate: (args: TArgs) => QueryKey[]) {
  const repo = useRepository()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => run(repo, args),
    onSuccess: async (_result, args) => {
      await Promise.all(invalidate(args).map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
}

const invoiceKeys = (invoice?: { id: string }) => [keys.invoices, keys.time, keys.people, ...(invoice?.id ? [keys.audit(invoice.id)] : [])]

/** Saves an invoice and frees any time entries whose lines were removed from it. */
export const useSaveInvoice = () =>
  useRepoMutation(async (repo, input: { invoice: Invoice; previous?: Invoice }) => {
    const saved = await repo.saveInvoice(input.invoice)
    const kept = new Set(saved.lines.flatMap((l) => (l.kind === 'time' && l.timeEntryId ? [l.timeEntryId] : [])))
    const removed = (input.previous?.lines ?? []).flatMap((l) => (l.kind === 'time' && l.timeEntryId && !kept.has(l.timeEntryId) ? [l.timeEntryId] : []))
    if (removed.length) await repo.setTimeEntriesInvoice(removed, null)
    return saved
  }, (input) => invoiceKeys(input.invoice))

export const useSendInvoice = () =>
  useRepoMutation((repo, id: string) => repo.sendInvoice(id), (id) => invoiceKeys({ id }))

export const useDeleteDraft = () => useRepoMutation((repo, id: string) => repo.deleteDraft(id), () => invoiceKeys())

export function useSetPaid() {
  const today = useToday()
  return useRepoMutation(
    (repo, input: { invoice: Invoice; paid: boolean; date?: string; amount?: number; amountSek?: number | null }) =>
      repo.saveInvoice(input.paid ? recordPayment(input.invoice, input.date ?? today, input.amount, input.amountSek) : markUnpaid(input.invoice)),
    (input) => invoiceKeys(input.invoice),
  )
}

export function useCreateInvoice() {
  const today = useToday()
  return useRepoMutation(async (repo, person: Person) => {
    const entries = await repo.listTimeEntries()
    let fxRateToSek: number | undefined
    if (person.defaultCurrency !== 'SEK') {
      // Today's Riksbank rate as a starting point; the SEK actually received is entered on payment.
      fxRateToSek = await fetchRateToSek(person.defaultCurrency, today).catch(async () => {
        const previous = (await repo.listInvoices()).find((i) => i.ownerId === person.id && i.currency === person.defaultCurrency)
        return previous?.fxRateToSek ?? 1
      })
    }
    const { invoice, timeEntryIds } = buildNewInvoice(person, { today, unbilled: entries, fxRateToSek })
    const saved = await repo.saveInvoice(invoice)
    if (timeEntryIds.length) await repo.setTimeEntriesInvoice(timeEntryIds, saved.id)
    return saved
  }, () => invoiceKeys())
}

/** Issues a credit note for the full invoice, sends it and marks the original as credited. */
export function useCreditInvoice() {
  const today = useToday()
  return useRepoMutation(async (repo, original: Invoice) => {
    const draft = await repo.saveInvoice(createCreditNote(original, { id: '', number: '', issueDate: today }))
    const sent = await repo.sendInvoice(draft.id)
    await repo.saveInvoice({ ...original, status: 'credited' })
    return sent
  }, (original) => invoiceKeys(original))
}

export const useSaveTimeEntry = () => useRepoMutation((repo, entry: TimeEntry) => repo.saveTimeEntry(entry), () => [keys.time])
export const useDeleteTimeEntry = () => useRepoMutation((repo, id: string) => repo.deleteTimeEntry(id), () => [keys.time])

export const useSaveExpense = () =>
  useRepoMutation(async (repo, input: { expense: Expense; receipt?: File | null }) => {
    let saved = await repo.saveExpense(input.expense)
    if (input.receipt) {
      const path = await repo.uploadReceipt(saved.id, input.receipt)
      saved = await repo.saveExpense({ ...saved, receiptPath: path })
    }
    return saved
  }, () => [keys.expenses])
export const useDeleteExpense = () => useRepoMutation((repo, id: string) => repo.deleteExpense(id), () => [keys.expenses])

export const useSaveDeduction = () => useRepoMutation((repo, d: Deduction) => repo.saveDeduction(d), () => [keys.deductions])
export const useDeleteDeduction = () => useRepoMutation((repo, id: string) => repo.deleteDeduction(id), () => [keys.deductions])

export const useSavePerson = () => useRepoMutation((repo, p: Person) => repo.savePerson(p), () => [keys.people])
export const useSaveTaxParams = () =>
  useRepoMutation((repo, p: TaxYearParams) => repo.saveTaxParams(p), (p) => [keys.tax(p.year)])
