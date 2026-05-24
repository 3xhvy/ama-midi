const BASE = import.meta.env.VITE_API_URL ?? ''

type ApiErrorBody = { message?: string | string[]; error?: string }

export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const body = (err as { body?: ApiErrorBody }).body
    const nested = body?.message
    if (typeof nested === 'string' && nested.trim()) return nested
    if (Array.isArray(nested) && typeof nested[0] === 'string') return nested[0]
    if (typeof body?.error === 'string' && body.error.trim()) return body.error
    if (err instanceof Error && err.message && err.message !== 'Internal Server Error') return err.message
  }
  return fallback
}

export function apiClient(token: string | null) {
  return async function <T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiErrorBody
      const err = new Error(extractApiErrorMessage({ body }, res.statusText)) as Error & { status: number; body: unknown }
      err.status = res.status
      err.body = body
      throw err
    }
    if (res.status === 204) return undefined as T
    return res.json()
  }
}
