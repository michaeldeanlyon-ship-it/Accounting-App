import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That address doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block font-medium text-accent hover:underline">Go to the dashboard</Link>
    </div>
  )
}
