import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

describe('Time page', () => {
  it('shows the unbilled time in hours and minutes', async () => {
    renderApp('/people/alex/time')
    expect(await screen.findByTestId('unbilled-summary')).toHaveTextContent('21 h 10 min')
  })

  it('logs a day with the hour and minute dropdowns', async () => {
    const { user } = renderApp('/people/alex/time')
    const form = await screen.findByRole('form', { name: 'Log a day' })
    await user.type(within(form).getByLabelText('What you did'), 'Proofreading chapter 4')
    await user.selectOptions(within(form).getByLabelText('Hours'), '2')
    await user.selectOptions(within(form).getByLabelText('Minutes'), '45')
    await user.click(within(form).getByRole('button', { name: 'Add day' }))
    const log = await screen.findByRole('list', { name: 'Time log' })
    expect(await within(log).findByText('Proofreading chapter 4')).toBeInTheDocument()
    expect(within(log).getByText('2 h 45 min')).toBeInTheDocument()
    expect(screen.getByTestId('unbilled-summary')).toHaveTextContent('23 h 55 min')
  })

  it('explains what is missing before adding a day', async () => {
    const { user } = renderApp('/people/alex/time')
    const form = await screen.findByRole('form', { name: 'Log a day' })
    await user.selectOptions(within(form).getByLabelText('Hours'), '0')
    await user.click(within(form).getByRole('button', { name: 'Add day' }))
    expect(await within(form).findByText('Add a short description first')).toBeInTheDocument()
    await user.type(within(form).getByLabelText('What you did'), 'Review')
    await user.click(within(form).getByRole('button', { name: 'Add day' }))
    expect(await within(form).findByText('Pick at least 5 minutes')).toBeInTheDocument()
  })

  it('lets you change the time on an unbilled day', async () => {
    const { user } = renderApp('/people/alex/time')
    const log = await screen.findByRole('list', { name: 'Time log' })
    const row = within(log).getAllByRole('listitem')[0]
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    await user.selectOptions(within(row).getByLabelText('Minutes'), '15')
    await user.click(within(row).getByRole('button', { name: 'Save' }))
    expect(await within(log).findByText('5 h 15 min')).toBeInTheDocument()
  })

  it('has no time tab for the sales contractor', async () => {
    renderApp('/people/sam/invoices')
    await screen.findByRole('heading', { name: /Sam/ })
    expect(screen.queryByRole('link', { name: 'Time' })).toBeNull()
  })
})
