import type { MonthCash } from '../../domain/dashboard'
import { formatMoney, money } from '../../domain/money'
import type { Person } from '../../domain/person'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const kr = (ore: number) => formatMoney(money(ore, 'SEK'), { decimals: 0 })

/** Stacked bars per month: received money solid, expected money faded, one colour per person. */
export function CashChart({ months, people }: { months: MonthCash[]; people: Person[] }) {
  const totals = months.map((m) => people.reduce((sum, p) => sum + (m.paid[p.id] ?? 0) + (m.expected[p.id] ?? 0), 0))
  const max = Math.max(1, ...totals)

  return (
    <figure>
      <div className="flex h-40 items-end gap-3" aria-hidden="true">
        {months.map((m, i) => (
          <div key={m.month} className="flex h-full flex-1 flex-col justify-end" title={`${MONTHS[Number(m.month.slice(5)) - 1]}: ${kr(totals[i])}`}>
            {people.flatMap((p) => [
              { key: `${p.id}-e`, value: m.expected[p.id] ?? 0, color: p.color, faded: true },
              { key: `${p.id}-p`, value: m.paid[p.id] ?? 0, color: p.color, faded: false },
            ])
              .filter((s) => s.value > 0)
              .map((s, idx) => (
                <div
                  key={s.key}
                  className={idx === 0 ? 'rounded-t-md' : ''}
                  style={{ height: `${(s.value / max) * 100}%`, backgroundColor: s.color, opacity: s.faded ? 0.35 : 1 }}
                />
              ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-xs text-muted" aria-hidden="true">
        {months.map((m) => <span key={m.month} className="flex-1 text-center">{MONTHS[Number(m.month.slice(5)) - 1]}</span>)}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {people.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />{p.displayName}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted opacity-35" />Faded: expected</span>
      </figcaption>
      <table className="sr-only">
        <caption>Money in by month</caption>
        <thead><tr><th>Month</th>{people.map((p) => <th key={p.id}>{p.displayName} received</th>)}{people.map((p) => <th key={p.id}>{p.displayName} expected</th>)}</tr></thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <td>{m.month}</td>
              {people.map((p) => <td key={p.id}>{kr(m.paid[p.id] ?? 0)}</td>)}
              {people.map((p) => <td key={p.id}>{kr(m.expected[p.id] ?? 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
