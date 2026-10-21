import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

describe('Tax page', () => {
  it('estimates the tax for the year and compares it with F-skatt', async () => {
    renderApp('/people/alex/tax')
    expect(await screen.findByRole('heading', { name: 'Tax 2026' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Estimated tax for the year' })).toHaveTextContent(/kr/)
    expect(screen.getByRole('group', { name: 'F-skatt paid so far' })).toHaveTextContent('70 000 kr')
    expect(screen.getByRole('group', { name: 'Not covered by F-skatt' })).toHaveTextContent(/[1-9]/)
    expect(screen.getByText(/F-skatt is about .* short for the year/)).toBeInTheDocument()
  })

  it('shows how a periodiseringsfond lowers the tax', async () => {
    renderApp('/people/alex/tax')
    const total = await screen.findByTestId('estimated-total')
    const before = total.textContent
    const slider = screen.getByLabelText('Periodiseringsfond')
    fireEvent.change(slider, { target: { value: slider.getAttribute('max') } })
    expect(screen.getByTestId('estimated-total').textContent).not.toBe(before)
    expect(screen.getByText(/lower this year's tax by about/)).toBeInTheDocument()
  })

  it('lists ways to lower the tax, with the saving', async () => {
    renderApp('/people/alex/tax')
    const list = await screen.findByRole('list', { name: 'Ways to lower your tax' })
    expect(within(list).getByText(/periodiseringsfond/i)).toBeInTheDocument()
    expect(within(list).getAllByText(/Saves about/).length).toBeGreaterThan(0)
  })

  it('shows the moms return for the current period for a VAT-registered person only', async () => {
    renderApp('/people/alex/tax')
    expect(await screen.findByRole('heading', { name: 'Moms Q4 2026' })).toBeInTheDocument()
  })

  it('has no moms section for someone not VAT registered', async () => {
    renderApp('/people/sam/tax')
    await screen.findByRole('heading', { name: 'Tax 2026' })
    expect(screen.queryByRole('heading', { name: /^Moms Q/ })).toBeNull()
  })
})
