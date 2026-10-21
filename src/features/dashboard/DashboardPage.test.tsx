import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { memoryRepo, renderApp } from '../../test/renderApp'

const kpi = (label: string) => screen.getByRole('group', { name: label })

describe('Dashboard', () => {
  it('shows money expected, overdue and paid at a glance', async () => {
    renderApp('/')
    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(await screen.findByRole('group', { name: 'Overdue' })).toHaveTextContent('31 188 kr')
    expect(kpi('Expected in the next 30 days')).toHaveTextContent('89 450 kr')
    expect(kpi('Paid this month')).toBeInTheDocument()
    expect(kpi('Tax to set aside')).toHaveTextContent(/Alex/)
  })

  it('marks a payment as paid with one click and can undo it', async () => {
    const { user } = renderApp('/')
    const box = await screen.findByRole('checkbox', { name: 'Mark A-0042 as paid' })
    await user.click(box)
    expect(await screen.findByRole('group', { name: 'Overdue' })).toHaveTextContent('12 500 kr')
    const row = screen.getByRole('checkbox', { name: 'Mark A-0042 as paid' }).closest('li')!
    expect(within(row).getByTestId('payment-status')).toHaveTextContent('Paid')
    await user.click(screen.getByRole('checkbox', { name: 'Mark A-0042 as paid' }))
    expect(await screen.findByRole('group', { name: 'Overdue' })).toHaveTextContent('31 188 kr')
  })

  it('lists incoming payments soonest first and links to the invoice', async () => {
    renderApp('/')
    const list = await screen.findByRole('list', { name: 'Incoming payments' })
    const first = within(list).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('A-0042')
    expect(within(first).getByRole('link', { name: /Nordic Lingua AB/ })).toHaveAttribute('href', '/people/alex/invoices/alex-42')
  })

  it('keeps the list short by hiding payments older than 30 days until asked', async () => {
    const { user } = renderApp('/')
    const list = await screen.findByRole('list', { name: 'Incoming payments' })
    expect(within(list).getByText(/S-0015/)).toBeInTheDocument()
    expect(within(list).queryByText(/S-0013/)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Show older payments/ }))
    expect(within(screen.getByRole('list', { name: 'Incoming payments' })).getByText(/S-0013/)).toBeInTheDocument()
  })

  it('shows tax not covered by F-skatt per person', async () => {
    renderApp('/')
    expect(await screen.findByRole('group', { name: 'Tax to set aside' })).toHaveTextContent(/Alex[\s\S]*[1-9][\d ]* kr/)
  })

  it('filters everything to one person', async () => {
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Sam' }))
    expect(await screen.findByRole('group', { name: 'Overdue' })).toHaveTextContent('12 500 kr')
    expect(within(screen.getByRole('list', { name: 'Incoming payments' })).queryByText(/A-00/)).toBeNull()
  })

  it('warns when the person without VAT is approaching the limit', async () => {
    renderApp('/')
    expect(await screen.findByText(/Sam has invoiced/)).toBeInTheDocument()
  })

  it('shows upcoming Skatteverket deadlines', async () => {
    renderApp('/')
    const deadlines = await screen.findByRole('list', { name: 'Upcoming deadlines' })
    expect(within(deadlines).getByText('Moms return Q3 (Jul–Sep)')).toBeInTheDocument()
    expect(within(deadlines).getAllByText('F-skatt instalment').length).toBeGreaterThan(0)
  })
})

describe('Paid tick feels instant', () => {
  it('shows the tick straight away while the save is still running', async () => {
    const repo = memoryRepo()
    let release: () => void = () => {}
    const original = repo.saveInvoice.bind(repo)
    repo.saveInvoice = async (invoice) => {
      await new Promise<void>((resolve) => { release = resolve })
      return original(invoice)
    }
    const { user } = renderApp('/', { repo })
    const box = await screen.findByRole('checkbox', { name: 'Mark A-0042 as paid' })
    await user.click(box)
    expect(screen.getByRole('checkbox', { name: 'Mark A-0042 as paid' })).toBeChecked()
    release()
    expect(await screen.findByRole('group', { name: 'Overdue' })).toHaveTextContent('12 500 kr')
  })

  it('is ticked in the same moment as the click, before anything async runs', async () => {
    renderApp('/')
    const box = await screen.findByRole('checkbox', { name: 'Mark A-0042 as paid' })
    fireEvent.click(box)
    expect(screen.getByRole('checkbox', { name: 'Mark A-0042 as paid' })).toBeChecked()
  })

  it('undoes the tick if saving fails', async () => {
    const repo = memoryRepo()
    repo.saveInvoice = async () => { throw new Error('Network down') }
    const { user } = renderApp('/', { repo })
    await user.click(await screen.findByRole('checkbox', { name: 'Mark A-0042 as paid' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark A-0042 as paid' })).not.toBeChecked())
  })
})
