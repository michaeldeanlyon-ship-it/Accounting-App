import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

describe('Settings page', () => {
  it('saves a change to a person\'s VAT status', async () => {
    const { user, repo } = renderApp('/settings')
    const sam = await screen.findByRole('region', { name: 'Sam' })
    await user.click(within(sam).getByLabelText('VAT registered'))
    await user.click(within(sam).getByRole('button', { name: 'Save Sam' }))
    expect(await within(sam).findByText('Saved')).toBeInTheDocument()
    expect((await repo.listPeople()).find((p) => p.id === 'sam')?.vatRegistered).toBe(true)
  })

  it('checks the org number before saving', async () => {
    const { user } = renderApp('/settings')
    const alex = await screen.findByRole('region', { name: 'Alex' })
    const org = within(alex).getByLabelText('Org number (personnummer)')
    await user.clear(org)
    await user.type(org, '123')
    await user.click(within(alex).getByRole('button', { name: 'Save Alex' }))
    expect(await within(alex).findByText(/Check the number/)).toBeInTheDocument()
  })

  it('lets you update the yearly tax rates', async () => {
    const { user, repo } = renderApp('/settings')
    const rates = await screen.findByRole('region', { name: 'Tax rates 2026' })
    const pbb = within(rates).getByLabelText('Prisbasbelopp (kr)')
    await user.clear(pbb)
    await user.type(pbb, '60000')
    await user.click(within(rates).getByRole('button', { name: 'Save rates' }))
    expect(await within(rates).findByText('Saved')).toBeInTheDocument()
    expect((await repo.getTaxParams(2026)).pbb).toBe(60000)
  })
})
