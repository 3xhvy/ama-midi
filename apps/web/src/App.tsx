import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAuthStore } from './store/auth.store'
import { useThemeStore } from './store/theme.store'
import { SongListPage } from './pages/SongListPage'
import { ProjectDashboardPage } from './features/projects/ProjectDashboardPage'
import { ProjectPage } from './features/projects/ProjectPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { EditorPage } from './pages/EditorPage'
import { AnalysisBoardPage } from './features/analysis/AnalysisBoardPage'
import { LegacySongEditorRedirect } from './pages/LegacySongEditorRedirect'
import { AuthCallbackPage }  from './pages/AuthCallbackPage'
import { ProfileSetupPage }  from './pages/ProfileSetupPage'
import { LoginPage }         from './pages/LoginPage'
import { OnboardingGate }    from './features/onboarding/OnboardingGate'
import { OnboardingFlowPage } from './features/onboarding/OnboardingFlowPage'
import { ProductTourOrchestrator } from './features/onboarding/ProductTourOrchestrator'
import { NotFoundPage } from './pages/NotFoundPage'
import { ForbiddenPage } from './pages/ForbiddenPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { resolved } = useThemeStore()

  useEffect(() => {
    if (resolved === 'dark') document.documentElement.classList.add('dark')
    else                     document.documentElement.classList.remove('dark')
  }, [resolved])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
        <OnboardingGate />
        <ProductTourOrchestrator />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/onboarding/:step" element={<RequireAuth><OnboardingFlowPage /></RequireAuth>} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/projects" element={<RequireAuth><ProjectDashboardPage /></RequireAuth>} />
          <Route path="/projects/:projectId" element={<RequireAuth><ProjectPage /></RequireAuth>} />
          <Route path="/projects/:projectId/songs/:songId" element={<RequireAuth><EditorPage /></RequireAuth>} />
          <Route path="/projects/:projectId/songs/:songId/charts/:chartId/analysis" element={<RequireAuth><AnalysisBoardPage /></RequireAuth>} />
          <Route path="/songs" element={<RequireAuth><SongListPage /></RequireAuth>} />
          <Route path="/songs/:songId" element={<RequireAuth><LegacySongEditorRedirect /></RequireAuth>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{ classNames: { toast: 'ama-toast' } }}
        />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
