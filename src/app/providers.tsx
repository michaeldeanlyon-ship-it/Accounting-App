import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { IsoDate } from '../domain/dates'
import type { Repository } from '../data/repository'
import { RepositoryContext, TodayContext } from './context'

export function AppProviders(props: { repository: Repository; queryClient: QueryClient; today?: IsoDate; children: ReactNode }) {
  return (
    <RepositoryContext.Provider value={props.repository}>
      <TodayContext.Provider value={props.today ?? null}>
        <QueryClientProvider client={props.queryClient}>{props.children}</QueryClientProvider>
      </TodayContext.Provider>
    </RepositoryContext.Provider>
  )
}
