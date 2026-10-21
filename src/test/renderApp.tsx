import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AppProviders } from '../app/providers'
import { demoSeed } from '../data/demoSeed'
import { createMemoryRepository } from '../data/memoryRepository'
import type { Repository } from '../data/repository'

export const TODAY = '2026-10-21'

export function memoryRepo(): Repository {
  return createMemoryRepository({ seed: demoSeed(TODAY) })
}

export function renderApp(path = '/', options: { repo?: Repository } = {}) {
  const repo = options.repo ?? memoryRepo()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const user = userEvent.setup()
  const view = render(
    <AppProviders repository={repo} today={TODAY} queryClient={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AppProviders>,
  )
  return { ...view, repo, user }
}
