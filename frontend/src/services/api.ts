export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed. Please try again.' }))
    throw new Error(body.error ?? 'Request failed. Please try again.')
  }
  return response.json() as Promise<T>
}
