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
  const res = await fetch(API_BASE + '/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeader()),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    await supabase.auth.signOut().catch(() => {})
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

export const downloadCsv = (eventId, title) =>
  downloadBlob(`/events/${eventId}/export.csv`, `${title.replace(/[^a-z0-9]+/gi, '_')}_attendance.csv`)

export const downloadAllStudentsCsv = () =>
  downloadBlob('/admin/students.csv', 'all_students.csv')
