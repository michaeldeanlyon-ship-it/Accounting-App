import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { memoryRepo, renderApp } from '../../test/renderApp'

const line = (n: number) => screen.getByRole('group', { name: `Line ${n}` })

describe('Invoice editor', () => {
  it('builds a translator invoice from unbilled days, showing hours and minutes per day', async () => {
    const { user } = renderApp('/people/alex/time')
    await user.click(await screen.findByRole('button', { name: /Create invoice from 4 unbilled days/ }))
    expect(await screen.findByRole('heading', { name: 'Draft invoice' })).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: /^Line \d+$/ })).toHaveLength(4)
    expect(within(line(1)).getByLabelText('Hours')).toHaveValue('6')
    expect(within(line(1)).getByLabelText('Minutes')).toHaveValue('30')
    expect(screen.getByTestId('total-time')).toHaveTextContent('21 h 10 min')
  })

  it('updates the totals when a day\'s hours change', async () => {
    const { user } = renderApp('/people/alex/time')
    await user.click(await screen.findByRole('button', { name: /Create invoice from 4 unbilled days/ }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    await user.selectOptions(within(line(1)).getByLabelText('Hours'), '7')
    expect(screen.getByTestId('total-time')).toHaveTextContent('22 h 10 min')
    expect(within(line(1)).getByTestId('line-total')).toHaveTextContent('4 875,00 kr')
  })

  it('numbers the invoice when it is marked as sent', async () => {
    const { user } = renderApp('/people/alex/time')
    await user.click(await screen.findByRole('button', { name: /Create invoice from 4 unbilled days/ }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    await user.click(screen.getByRole('button', { name: 'Save and mark as sent' }))
    expect(await screen.findByRole('heading', { name: 'Invoice A-0045' })).toBeInTheDocument()
  })

  it('pre-fills the sales invoice in USD with base fee and a commission amount', async () => {
    const { user } = renderApp('/people/sam/invoices')
    await user.click(await screen.findByRole('button', { name: 'New invoice' }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    expect(screen.getByLabelText('Currency')).toHaveValue('USD')
    expect(within(line(1)).getByLabelText('Description')).toHaveValue('Base fee 16–31 Oct')
    expect(within(line(2)).getByLabelText('Description')).toHaveValue('Commission 16–31 Oct')
    const commission = within(line(2)).getByLabelText('Amount (USD)')
    await user.type(commission, '2250')
    expect(screen.getByTestId('total-gross')).toHaveTextContent(/12,250.00/)
    expect(screen.getAllByText(/Momsbefriad/).length).toBeGreaterThan(0)
  })

  it('records the SEK that actually arrived for a USD invoice', async () => {
    const { user, repo } = renderApp('/people/sam/invoices')
    await user.click(await screen.findByRole('button', { name: 'New invoice' }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    await user.type(within(line(2)).getByLabelText('Amount (USD)'), '2250')
    await user.click(screen.getByRole('button', { name: 'Save and mark as sent' }))
    await screen.findByRole('heading', { name: /^Invoice S-/ })
    await user.type(screen.getByLabelText('Amount received (SEK)'), '126500')
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }))
    expect(await screen.findByText(/126 500,00 kr received/)).toBeInTheDocument()
    const saved = (await repo.listInvoices()).find((i) => i.ownerId === 'sam' && i.currency === 'USD')!
    expect(saved.paidAmountSek).toBe(12_650_000)
  })

  it('lets the translator list days with their time and type one total amount', async () => {
    const repo = memoryRepo()
    const alex = (await repo.listPeople()).find((p) => p.id === 'alex')!
    await repo.savePerson({ ...alex, hourlyRate: 0 })
    const { user } = renderApp('/people/alex/time', { repo })
    await user.click(await screen.findByRole('button', { name: /Create invoice from 4 unbilled days/ }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    expect(within(line(1)).queryByLabelText(/Rate/)).toBeNull()
    expect(within(line(1)).queryByLabelText('Moms')).toBeNull()
    expect(within(line(1)).getByLabelText('Hours')).toHaveValue('6')
    expect(within(line(5)).getByLabelText('Description')).toHaveValue('Translation services')
    await user.type(within(line(5)).getByLabelText('Amount (kr)'), '15000')
    expect(screen.getByTestId('total-time')).toHaveTextContent('21 h 10 min')
    expect(screen.getByTestId('total-gross')).toHaveTextContent('18 750,00 kr')
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    const doc = screen.getByRole('article', { name: 'Invoice preview' })
    expect(doc).toHaveTextContent('6 h 30 min')
    expect(doc).toHaveTextContent('Total time')
  })

  it('stops you sending an invoice without a client', async () => {
    const { user } = renderApp('/people/sam/invoices')
    await user.click(await screen.findByRole('button', { name: 'New invoice' }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    await user.clear(screen.getByLabelText('Client'))
    await user.click(screen.getByRole('button', { name: 'Save and mark as sent' }))
    expect(await screen.findByText(/Add the client name/)).toBeInTheDocument()
  })

  it('keeps sent invoices editable and records each change', async () => {
    const { user } = renderApp('/people/alex/invoices/alex-44')
    expect(await screen.findByRole('heading', { name: 'Invoice A-0044' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Notes'), 'PO 1234')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Changed notes/)).toBeInTheDocument()
  })

  it('marks an invoice as paid and unpaid', async () => {
    const { user } = renderApp('/people/alex/invoices/alex-44')
    await screen.findByRole('heading', { name: 'Invoice A-0044' })
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }))
    expect(await screen.findByRole('button', { name: 'Mark as unpaid' })).toBeInTheDocument()
    expect(screen.getByTestId('invoice-status')).toHaveTextContent('Paid')
  })

  it('cancels a sent invoice with a credit note', async () => {
    const { user } = renderApp('/people/alex/invoices/alex-44')
    await screen.findByRole('heading', { name: 'Invoice A-0044' })
    await user.click(screen.getByRole('button', { name: 'Create credit note' }))
    expect(await screen.findByRole('heading', { name: 'Credit note A-0045' })).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toHaveValue('Credit note for invoice A-0044')
  })

  it('deletes a draft and returns its days to unbilled', async () => {
    const { user } = renderApp('/people/alex/time')
    await user.click(await screen.findByRole('button', { name: /Create invoice from 4 unbilled days/ }))
    await screen.findByRole('heading', { name: 'Draft invoice' })
    await user.click(screen.getByRole('button', { name: 'Delete draft' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await user.click(await screen.findByRole('link', { name: 'Time' }))
    expect(await screen.findByRole('button', { name: /Create invoice from 4 unbilled days/ })).toBeInTheDocument()
  })

  it('shows a printable invoice with the mandatory details', async () => {
    const { user } = renderApp('/people/alex/invoices/alex-43')
    await screen.findByRole('heading', { name: 'Invoice A-0043' })
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    const doc = screen.getByRole('article', { name: 'Invoice preview' })
    expect(doc).toHaveTextContent('Godkänd för F-skatt')
    expect(doc).toHaveTextContent('Omvänd betalningsskyldighet')
    expect(doc).toHaveTextContent('SE811218987601')
    expect(doc).toHaveTextContent('DE123456789')
    expect(screen.getByRole('link', { name: 'Print or save as PDF' })).toHaveAttribute('href', '/invoices/alex-43/print')
  })
})
