const BASE = import.meta.env.VITE_API_URL ?? ''

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
      const body = await res.json().catch(() => ({}))
      const err = new Error(body?.error ?? res.statusText) as Error & { status: number; body: unknown }
      err.status = res.status
      err.body = body
      throw err
    }
    if (res.status === 204) return undefined as T
    return res.json()
  }
}
