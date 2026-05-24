import { ErrorPageLayout } from './ErrorPageLayout'

export function ForbiddenPage() {
  return (
    <ErrorPageLayout
      status={403}
      title="Access denied"
      description="You do not have permission to view this page. Ask a project admin if you need access."
    />
  )
}
