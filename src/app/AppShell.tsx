import { NavLink, Outlet } from 'react-router-dom'
import { Button, PersonDot } from '../components/ui'
import { usePeople } from '../data/hooks'
import { useRepository } from './context'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-canvas hover:text-ink'
  }`

export function AppShell() {
  const repo = useRepository()
  const people = usePeople()

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-ink">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">L</span>
            Ledger
          </NavLink>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
            {(people.data ?? []).map((p) => (
              <NavLink key={p.id} to={`/people/${p.id}/invoices`} className={linkClass}>
                <PersonDot color={p.color} />
                {p.displayName}
              </NavLink>
            ))}
            <NavLink to="/settings" className={linkClass}>Settings</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {repo.mode === 'demo' && (
              <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning" title="Data is kept in this browser only">
                Demo mode
              </span>
            )}
            {repo.mode === 'supabase' && <Button variant="ghost" size="sm" onClick={() => repo.signOut()}>Sign out</Button>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
