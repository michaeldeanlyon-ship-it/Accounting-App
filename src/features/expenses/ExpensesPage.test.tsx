import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

describe('Expenses page', () => {
  it('adds an expense and splits out the moms for a VAT-registered person', async () => {
    const { user } = renderApp('/people/alex/expenses')
    const form = await screen.findByRole('form', { name: 'Add an expense' })
    await user.type(within(form).getByLabelText('Supplier'), 'Clas Ohlson')
    await user.type(within(form).getByLabelText('Amount incl. moms (kr)'), '500')
    await user.click(within(form).getByRole('button', { name: 'Add expense' }))
    const list = await screen.findByRole('list', { name: 'Expenses' })
    const row = (await within(list).findByText('Clas Ohlson')).closest('li')!
    expect(row).toHaveTextContent('500,00 kr')
    expect(row).toHaveTextContent('moms 100,00 kr')
  })

  it('does not reclaim moms for someone who is not VAT registered', async () => {
    const { user } = renderApp('/people/sam/expenses')
    const form = await screen.findByRole('form', { name: 'Add an expense' })
    expect(within(form).queryByLabelText('Moms rate')).toBeNull()
    await user.type(within(form).getByLabelText('Supplier'), 'Ikea')
    await user.type(within(form).getByLabelText('Amount incl. moms (kr)'), '200')
    await user.click(within(form).getByRole('button', { name: 'Add expense' }))
    const row = (await screen.findByText('Ikea')).closest('li')!
    expect(row).toHaveTextContent('no moms reclaim')
  })

  it('asks for the supplier before adding', async () => {
    const { user } = renderApp('/people/alex/expenses')
    const form = await screen.findByRole('form', { name: 'Add an expense' })
    await user.click(within(form).getByRole('button', { name: 'Add expense' }))
    expect(await within(form).findByText('Add the supplier name')).toBeInTheDocument()
  })

  it('claims the home office deduction and logs business mileage', async () => {
    const { user } = renderApp('/people/alex/expenses')
    await user.click(await screen.findByRole('button', { name: 'Claim home office (4 000 kr)' }))
    const deductions = await screen.findByRole('list', { name: 'Deductions' })
    expect(await within(deductions).findByText('Home office (schablonavdrag)')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Mil driven'), '12')
    await user.click(screen.getByRole('button', { name: 'Add trip' }))
    expect(await within(deductions).findByText('300 kr')).toBeInTheDocument()
  })
})
