import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

interface ErrorPageLayoutProps {
  status: number
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
}

export function ErrorPageLayout({
  status,
  title,
  description,
  actionLabel = 'Back to dashboard',
  actionTo = '/',
}: ErrorPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-shell-bg px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-primary/70">{status}</p>
      <h1 className="mt-3 text-2xl font-semibold text-shell-fg">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-shell-muted">{description}</p>
      <Link to={actionTo} className="mt-8">
        <Button variant="primary">{actionLabel}</Button>
      </Link>
    </div>
  )
}
