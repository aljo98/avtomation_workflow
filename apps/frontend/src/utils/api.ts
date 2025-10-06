export async function api(path: string, opts: RequestInit = {}) {
  const base = 'http://localhost:4411'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = localStorage.getItem('jwt')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(base + path, { ...opts, headers })
  return res
}

export const apiDefault = api
