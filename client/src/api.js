// api.js — one place that talks to the server. Attaches the Supabase access token to
// every request and turns server errors into thrown Errors the pages can show.
import { supabase } from './supabase.js'

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

const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}
}

export async function api(path, { method = 'GET', body, raw } = {}) {
  const send = async () => fetch(API_BASE + '/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeader()),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let res = await send()
  // A 401 can just mean the access token expired while the phone slept. Refresh and retry once;
  // only a session that can't be refreshed is signed out (that means a new email code).
  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) res = await send()
  }
  if (res.status === 401) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    window.dispatchEvent(new Event('ce-logout'))
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

async function downloadBlob(path, filename) {
  const res = await api(path, { raw: true })
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// year = 1-4 for one year of study's sheet, omitted for everyone.
export const downloadCsv = (eventId, title, year) =>
  downloadBlob(
    `/events/${eventId}/export.csv${year ? `?year=${year}` : ''}`,
    `${title.replace(/[^a-z0-9]+/gi, '_')}${year ? `_year${year}` : ''}_attendance.csv`,
  )

export const downloadAllStudentsCsv = () =>
  downloadBlob('/admin/students.csv', 'all_students.csv')
