import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryRepository } from './memoryRepository'
import { demoSeed } from './demoSeed'
import type { Repository } from './repository'
import type { Invoice } from '../domain/invoice'

let repo: Repository

function draft(over: Partial<Invoice> = {}): Invoice {
  return {
    id: '', ownerId: 'alex', number: '', clientId: null, clientName: 'Nordic Lingua AB', issueDate: '2026-10-21',
    dueDate: '2026-11-20', currency: 'SEK', fxRateToSek: 1, vatTreatment: 'domestic', status: 'draft', paidDate: null,
    paidAmount: null, creditsInvoiceId: null, notes: '',
    lines: [{ id: 'l1', kind: 'fixed', description: 'Proofreading', quantity: 1, unit: 'st', unitPrice: 100_000, vatRate: 25 }],
    ...over,
  }
}

beforeEach(() => {
  repo = createMemoryRepository({ seed: demoSeed('2026-10-21') })
})

describe('memory repository', () => {
  it('starts signed in as the demo user with both people', async () => {
    expect(await repo.getSession()).not.toBeNull()
    expect((await repo.listPeople()).map((p) => p.id)).toEqual(['alex', 'sam'])
  })

  it('saves a new draft and gives it an id but no number', async () => {
    const saved = await repo.saveInvoice(draft())
    expect(saved.id).not.toBe('')
    expect(saved.number).toBe('')
    expect((await repo.listInvoices()).some((i) => i.id === saved.id)).toBe(true)
  })

  it('assigns the next number in the person\'s series when sending', async () => {
    const before = (await repo.listPeople()).find((p) => p.id === 'alex')!.nextInvoiceNumber
    const a = await repo.sendInvoice((await repo.saveInvoice(draft())).id)
    const b = await repo.sendInvoice((await repo.saveInvoice(draft())).id)
    expect(a.status).toBe('sent')
    expect(a.number).toBe(`A-${String(before).padStart(4, '0')}`)
    expect(b.number).toBe(`A-${String(before + 1).padStart(4, '0')}`)
  })

  it('refuses to send an invoice that is not ready', async () => {
    const saved = await repo.saveInvoice(draft({ clientName: '' }))
    await expect(repo.sendInvoice(saved.id)).rejects.toThrow('Add the client name')
  })

  it('logs changes to a sent invoice in the audit log', async () => {
    const sent = await repo.sendInvoice((await repo.saveInvoice(draft())).id)
    await repo.saveInvoice({ ...sent, notes: 'Changed after sending' })
    const log = await repo.listAuditLog(sent.id)
    expect(log).toHaveLength(1)
    expect(log[0].summary).toMatch(/notes/)
  })

  it('does not log changes to drafts', async () => {
    const saved = await repo.saveInvoice(draft())
    await repo.saveInvoice({ ...saved, notes: 'Still a draft' })
    expect(await repo.listAuditLog(saved.id)).toHaveLength(0)
  })

  it('deletes a draft and releases its time entries', async () => {
    const entry = await repo.saveTimeEntry({ id: '', ownerId: 'alex', projectId: null, workDate: '2026-10-21', minutes: 120, note: 'x', invoiceId: null })
    const saved = await repo.saveInvoice(draft())
    await repo.setTimeEntriesInvoice([entry.id], saved.id)
    await repo.deleteDraft(saved.id)
    expect((await repo.listInvoices()).some((i) => i.id === saved.id)).toBe(false)
    expect((await repo.listTimeEntries()).find((e) => e.id === entry.id)?.invoiceId).toBeNull()
  })

  it('refuses to delete a sent invoice', async () => {
    const sent = await repo.sendInvoice((await repo.saveInvoice(draft())).id)
    await expect(repo.deleteDraft(sent.id)).rejects.toThrow('Sent invoices cannot be deleted. Issue a credit note instead.')
  })

  it('prevents a time entry from being billed twice', async () => {
    const entry = await repo.saveTimeEntry({ id: '', ownerId: 'alex', projectId: null, workDate: '2026-10-21', minutes: 60, note: 'x', invoiceId: null })
    await repo.setTimeEntriesInvoice([entry.id], 'inv-a')
    await expect(repo.setTimeEntriesInvoice([entry.id], 'inv-b')).rejects.toThrow(/already on an invoice/)
  })

  it('rejects a time entry outside 1 minute to 24 hours', async () => {
    await expect(repo.saveTimeEntry({ id: '', ownerId: 'alex', projectId: null, workDate: '2026-10-21', minutes: 0, note: 'x', invoiceId: null }))
      .rejects.toThrow('Pick at least 5 minutes')
  })

  it('keeps data between sessions when given storage', async () => {
    const storage = new Map<string, string>()
    const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) }
    const first = createMemoryRepository({ seed: demoSeed('2026-10-21'), storage: store })
    const saved = await first.saveInvoice(draft({ notes: 'remember me' }))
    const second = createMemoryRepository({ seed: demoSeed('2026-10-21'), storage: store })
    expect((await second.listInvoices()).find((i) => i.id === saved.id)?.notes).toBe('remember me')
  })

  it('returns tax params for a year', async () => {
    expect((await repo.getTaxParams(2026)).year).toBe(2026)
  })
})
