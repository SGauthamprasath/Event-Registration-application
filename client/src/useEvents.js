import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

const ms = (iso) => Date.parse(iso)
const statusAt = (e, t) => (t < ms(e.starts_at) ? 'upcoming' : t < ms(e.ends_at) ? 'live' : 'ended')
const attendanceOpenAt = (e, t) => t >= ms(e.starts_at) && t < ms(e.attendance_closes_at || e.ends_at)

// Loads events, refreshes every 10 s (fresh live counts + clock re-sync), and ticks every
// second so the Upcoming -> Live -> Ended badge flips on screen at the right second
// without a reload. The server re-checks every action anyway; this only drives the display.
export function useEvents() {
  const [events, setEvents] = useState([])
  const [offset, setOffset] = useState(0) // serverTime - phoneTime, corrects a wrong phone clock
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api('/events')
      setOffset(d.serverTime - Date.now())
      setEvents(d.events)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const serverNow = now + offset
  const withStatus = events.map((e) => ({
    ...e,
    status: statusAt(e, serverNow),
    attendance_open: attendanceOpenAt(e, serverNow),
  }))
  return { events: withStatus, loading, error, reload: load, serverNow }
}

export const fmtTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })

export const fmtHour = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
