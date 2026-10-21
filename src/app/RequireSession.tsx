import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoading } from '../components/ui'
import { useSession } from './context'

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (session === undefined) return <PageLoading />
  if (session === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
