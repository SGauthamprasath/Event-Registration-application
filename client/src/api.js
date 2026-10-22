// api.js - one place that talks to the server. Adds the login token to every request
// and turns server errors into thrown Errors the pages can show.
const TOKEN_KEY = 'ce_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

// A random id for THIS browser, created once. The server allows one device to mark
// only one student per event, which stops one phone marking for a group of friends.
export function getDeviceId() {
  let id = localStorage.getItem('ce_device')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('ce_device', id)
  }
  return id
}

export async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && getToken()) {
    setToken(null)
    window.dispatchEvent(new Event('ce-logout')) // AuthProvider listens and sends the user to /login
  }
  if (raw) {
    if (!res.ok) throw new Error('Request failed')
    return res
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || data.status || 'Request failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// CSV download needs the login header, so we fetch it as a blob and click a temporary link.
export async function downloadCsv(eventId, title) {
  const res = await api(`/events/${eventId}/export.csv`, { raw: true })
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]+/gi, '_')}_attendance.csv`
  a.click()
  URL.revokeObjectURL(url)
}
