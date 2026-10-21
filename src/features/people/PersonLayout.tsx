import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorText, PageLoading } from '../../components/ui'
import { VAT_PERIOD_LABELS } from '../../domain/person'
import { useCreateInvoice, usePeople } from '../../data/hooks'
import { NotFoundPage } from '../NotFoundPage'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-10 items-center border-b-2 px-1 text-sm font-medium ${isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`

export function PersonLayout() {
  const { personId } = useParams()
  const people = usePeople()
  const createInvoice = useCreateInvoice()
  const navigate = useNavigate()

  if (!people.data) return <PageLoading />
  const person = people.data.find((p) => p.id === personId)
  if (!person) return <NotFoundPage />

  const tabs = [
    { to: 'invoices', label: 'Invoices' },
    ...(person.workStyle === 'hourly' ? [{ to: 'time', label: 'Time' }] : []),
    { to: 'expenses', label: 'Expenses' },
    { to: 'tax', label: 'Tax' },
  ]

  async function newInvoice() {
    const saved = await createInvoice.mutateAsync(person!)
    navigate(`/people/${person!.id}/invoices/${saved.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: person.color }}
          >
            {person.displayName.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold">{person.displayName} · {person.roleTitle}</h1>
            <p className="text-sm text-muted">
              Enskild firma · F-skatt · {person.vatRegistered ? `VAT registered (${VAT_PERIOD_LABELS[person.vatPeriod].toLowerCase()})` : 'Not VAT registered'}
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={newInvoice} disabled={createInvoice.isPending}><span aria-hidden="true">+</span> New invoice</Button>
      </div>
      <ErrorText error={createInvoice.error} />
      <nav aria-label={`${person.displayName} sections`} className="flex gap-6 border-b border-line">
        {tabs.map((t) => <NavLink key={t.to} to={t.to} className={tabClass}>{t.label}</NavLink>)}
      </nav>
      <Outlet context={{ person }} />
    </div>
  )
}
