import { ErrorPageLayout } from './ErrorPageLayout'

export function ServerErrorPage() {
  return (
    <ErrorPageLayout
      status={500}
      title="Something went wrong"
      description="An unexpected error occurred. Try again, or return to your dashboard if the problem continues."
    />
  )
}
