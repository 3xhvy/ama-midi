import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAuthStore } from './store/auth.store'
import { SongListPage } from './pages/SongListPage'
import { EditorPage } from './pages/EditorPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { LoginPage } from './pages/LoginPage'

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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<RequireAuth><SongListPage /></RequireAuth>} />
          <Route path="/songs/:songId" element={<RequireAuth><EditorPage /></RequireAuth>} />
        </Routes>
        <Toaster position="bottom-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
