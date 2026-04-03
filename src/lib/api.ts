import { useAuthStore } from './stores'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { token } = useAuthStore.getState()

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Non autorisé')
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type')
    let message = `Erreur ${res.status}`
    if (contentType?.includes('application/json')) {
      const data = await res.json().catch(() => ({ error: message }))
      message = data.error || message
    }
    throw new Error(message)
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
}
