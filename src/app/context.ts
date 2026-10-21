import { createContext, useContext, useEffect, useState } from 'react'
import { todayIso, type IsoDate } from '../domain/dates'
import type { Repository, Session } from '../data/repository'

export const RepositoryContext = createContext<Repository | null>(null)
export const TodayContext = createContext<IsoDate | null>(null)

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository must be used inside AppProviders')
  return repo
}

/** Today's date; fixed in tests, the real date in the app. */
export function useToday(): IsoDate {
  return useContext(TodayContext) ?? todayIso()
}

/** undefined while loading, null when signed out. */
export function useSession(): Session | null | undefined {
  const repo = useRepository()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    let active = true
    repo.getSession().then((s) => active && setSession(s))
    const unsubscribe = repo.onAuthChange((s) => active && setSession(s))
    return () => {
      active = false
      unsubscribe()
    }
  }, [repo])
  return session
}
