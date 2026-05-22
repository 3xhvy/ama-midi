import { AmanotesLogo } from '../components/AmanotesLogo'
import { AppShell } from '../components/layout'

const GOOGLE_AUTH_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/auth/google`
  : '/auth/google'

function GradientRim({
  children,
  className = '',
  rounded = 'rounded-2xl',
}: {
  children: React.ReactNode
  className?: string
  rounded?: string
}) {
  return (
    <div
      className={`bg-gradient-to-r from-amanotes-pink to-amanotes-purple p-px ${rounded} ${className}`}
    >
      {children}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function LoginPage() {
  return (
    <AppShell showHeader={false} maxWidth="480px" className="flex min-h-screen items-center justify-center">
      <main
        className="flex w-full flex-col items-center gap-8 py-12"
        aria-labelledby="login-title"
      >
        <AmanotesLogo className="h-10 w-auto max-w-[min(100%,280px)]" />

        <GradientRim className="w-full shadow-amanotes" rounded="rounded-2xl">
          <div className="flex flex-col gap-6 rounded-2xl bg-shell-surface px-8 py-8 text-center">
            <div className="flex flex-col gap-2">
              <h1 id="login-title" className="text-2xl font-semibold text-shell-text">
                AMA-MIDI
              </h1>
              <p className="text-sm text-shell-muted">Collaborative MIDI note editor</p>
            </div>

            <GradientRim rounded="rounded-lg">
              <a
                href={GOOGLE_AUTH_URL}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-shell-surface px-6 py-3 text-sm font-medium text-shell-text transition-colors hover:bg-shell-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <GoogleIcon />
                Sign in with Google
              </a>
            </GradientRim>
          </div>
        </GradientRim>
      </main>
    </AppShell>
  )
}
