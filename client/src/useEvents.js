import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from './api.js'

const ms = (iso) => Date.parse(iso)
const statusAt = (e, t) => (t < ms(e.starts_at) ? 'upcoming' : t < ms(e.ends_at) ? 'live' : 'ended')
const attendanceOpenAt = (e, t) => t >= ms(e.attendance_opens_at || e.starts_at) && t < ms(e.attendance_closes_at || e.ends_at)

// One shared poller for every component that calls useEvents() (the top bar and the page each
// used to run their own). It runs while anything is subscribed, pauses while the tab is hidden,
// and refreshes as soon as the tab is visible again. State resets when the last subscriber
// leaves (logout), so the next account never sees the previous one's flags.
const POLL_MS = 10000
const EMPTY = { events: [], offset: 0, loading: true, error: '' } // offset = serverTime - phoneTime
let state = EMPTY
let timer = null
let inflight = null
const listeners = new Set()

const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }

function load() {
  if (inflight) return inflight
  inflight = api('/events')
    .then((d) => emit({ events: d.events, offset: d.serverTime - Date.now(), error: '', loading: false }))
    .catch((e) => emit({ error: e.message, loading: false }))
    .finally(() => { inflight = null })
  return inflight
}

function schedule() {
  clearInterval(timer)
  timer = document.hidden ? null : setInterval(load, POLL_MS)
}

function onVisibility() {
  if (!document.hidden) load()
  schedule()
}

function subscribe(listener) {
  listeners.add(listener)
  if (listeners.size === 1) {
    load()
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer); timer = null
      document.removeEventListener('visibilitychange', onVisibility)
      state = EMPTY
    }
  }
}

// Ticks every second so the Upcoming -> Live -> Ended badge flips on screen at the right
// second without a reload. The server re-checks every action anyway; this only drives the display.
export function useEvents() {
  const { events, offset, loading, error } = useSyncExternalStore(subscribe, () => state)
  const [now, setNow] = useState(Date.now())

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
