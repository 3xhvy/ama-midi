import { ErrorPageLayout } from './ErrorPageLayout'

export function NotFoundPage() {
  return (
    <ErrorPageLayout
      status={404}
      title="Page not found"
      description="This URL does not match any page in AMA-MIDI. Check the link or return to your dashboard."
    />
  )
}
