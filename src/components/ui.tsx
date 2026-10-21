import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '../domain/invoice'

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong border border-transparent',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-canvas',
  danger: 'bg-white text-danger border border-danger-line hover:bg-danger-soft',
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Card({ title, actions, children, className, labelledBy }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; labelledBy?: string }) {
  const id = useId()
  return (
    <section className={cx('rounded-xl border border-line bg-white p-5', className)} aria-labelledby={title ? (labelledBy ?? id) : undefined}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 id={labelledBy ?? id} className="text-base font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent'

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink', success: 'text-success', warning: 'text-warning', danger: 'text-danger', accent: 'text-accent',
}

export function Kpi({ label, value, hint, tone = 'neutral', children }: { label: string; value?: ReactNode; hint?: ReactNode; tone?: Tone; children?: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="rounded-xl border border-line bg-white p-4">
      <p id={id} className="text-sm text-muted">{label}</p>
      {value !== undefined && <p className={cx('mt-1 text-2xl font-semibold tabular-nums', TONE_TEXT[tone])}>{value}</p>}
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  draft: 'bg-canvas text-muted',
  sent: 'bg-accent-soft text-accent',
  due_soon: 'bg-warning-soft text-warning',
  overdue: 'bg-danger-soft text-danger',
  part_paid: 'bg-warning-soft text-warning',
  paid: 'bg-success-soft text-success',
  credited: 'bg-canvas text-muted line-through',
}

export function StatusPill({ status, testId }: { status: InvoiceStatus; testId?: string }) {
  return (
    <span data-testid={testId} className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_STYLE[status])}>
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}

const NOTICE_STYLE: Record<Exclude<Tone, 'accent'>, string> = {
  neutral: 'border-line bg-canvas text-ink',
  success: 'border-success-line bg-success-soft text-success',
  warning: 'border-warning-line bg-warning-soft text-warning',
  danger: 'border-danger-line bg-danger-soft text-danger',
}

export function Notice({ tone = 'neutral', title, children }: { tone?: Exclude<Tone, 'accent'>; title?: ReactNode; children?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm', NOTICE_STYLE[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  )
}

export const inputClass =
  'block w-full rounded-lg border border-line bg-white px-3 h-10 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-canvas'

export function Field({ label, error, hint, children, className }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('block', className)}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
        {children}
      </label>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  )
}

export function PersonDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageLoading() {
  return <p className="py-10 text-center text-sm text-muted" role="status">Loading…</p>
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return <p role="alert" className="text-sm text-danger">{error instanceof Error ? error.message : String(error)}</p>
}
