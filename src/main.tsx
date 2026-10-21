import { QueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProviders } from './app/providers'
import { todayIso } from './domain/dates'
import { demoSeed } from './data/demoSeed'
import { createMemoryRepository } from './data/memoryRepository'
import type { Repository } from './data/repository'
import { createSupabaseRepository } from './data/supabaseRepository'
import './index.css'

function createRepository(): Repository {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return createSupabaseRepository(createClient(url, key))
  // No Supabase configured: demo mode with sample data kept in this browser.
  let storage: Storage | undefined
  try {
    storage = window.localStorage
  } catch {
    storage = undefined
  }
  return createMemoryRepository({ seed: demoSeed(todayIso()), storage })
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders repository={createRepository()} queryClient={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
)
