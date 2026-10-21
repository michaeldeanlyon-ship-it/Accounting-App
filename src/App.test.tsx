import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { memoryRepo, renderApp } from './test/renderApp'

describe('App', () => {
  it('renders the dashboard with a link for each person', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(await within(nav).findByRole('link', { name: /Alex/ })).toHaveAttribute('href', '/people/alex/invoices')
    expect(within(nav).getByRole('link', { name: /Sam/ })).toHaveAttribute('href', '/people/sam/invoices')
  })

  it('says when it is running in demo mode', async () => {
    renderApp('/')
    expect(await screen.findByText(/Demo mode/)).toBeInTheDocument()
  })

  it('asks you to sign in when signed out, then opens the dashboard', async () => {
    const repo = memoryRepo()
    await repo.signOut()
    const { user } = renderApp('/', { repo })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows a friendly page for unknown addresses', async () => {
    renderApp('/nowhere')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
