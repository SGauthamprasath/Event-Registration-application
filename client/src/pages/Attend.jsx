import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { api, getDeviceId } from '../api.js'
import { useEvents } from '../useEvents.js'

const MESSAGES = {
  marked: ['✓ Attendance marked', 'ok'],
  duplicate: ['✓ You are already marked present', 'ok'],
  expired: ['That code expired. Scan the screen again.', 'warn'],
  closed: ['Attendance is closed for this event.', 'error'],
  not_started: ['This event has not started yet.', 'error'],
  not_registered: ['You did not register for this event.', 'error'],
  device_used: ['This phone has already marked another student for this event.', 'error'],
  too_many_attempts: ['Too many attempts. Wait a minute and try again.', 'error'],
}

export default function Attend() {
  const { id } = useParams()
  const { events, loading } = useEvents()
  const ev = events.find((e) => e.id === Number(id))
  const [result, setResult] = useState(null) // { status }
  const [camError, setCamError] = useState('')
  const busy = useRef(false)
  const scannerRef = useRef(null)

  const canScan = ev && ev.registered && ev.status === 'live' && ev.attendance_open && !ev.attended
  const done = result && ['marked', 'duplicate'].includes(result.status)

  useEffect(() => {
    if (!canScan || done) return
    const scanner = new Html5Qrcode('reader')
    scannerRef.current = scanner
    let cancelled = false

    async function onScan(text) {
      if (busy.current) return          // the camera reports the same QR many times a second: send once
      busy.current = true
      try {
        const d = await api(`/events/${id}/attend`, { method: 'POST', body: { token: text, deviceId: getDeviceId() } })
        setResult(d)
      } catch (e) {
        setResult({ status: e.data?.status || 'error', message: e.message })
      }
      setTimeout(() => { busy.current = false }, 1500) // short cooldown before the next try
    }

    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, () => {})
      .catch(() => !cancelled && setCamError('Camera not available. Allow camera access in your browser, and make sure the site is opened over HTTPS.'))

    return () => {
      cancelled = true
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [canScan, done, id])

  if (loading) return <p className="muted">Loading…</p>
  if (!ev) return <p className="error">Event not found. <Link to="/">Back</Link></p>

  const msg = result && (MESSAGES[result.status] || [result.message || 'Something went wrong', 'error'])

  return (
    <div className="card narrow stack">
      <h1>{ev.title}</h1>
      <p className="muted">Attendance</p>

      {!ev.registered && <p className="error">You are not registered for this event.</p>}
      {ev.registered && ev.status === 'upcoming' && <p>This event has not started. Attendance opens at the start time.</p>}
      {ev.registered && ev.status !== 'upcoming' && !ev.attendance_open && !ev.attended && <p className="error">Attendance is closed.</p>}
      {(ev.attended || done) && <p className="result ok">✓ Your attendance is marked.</p>}

      {canScan && !done && (
        <>
          <p>Point your camera at the QR code on the projector screen.</p>
          <div id="reader" className="reader" />
          {camError && <p className="error">{camError}</p>}
        </>
      )}
      {msg && !done && <p className={`result ${msg[1]}`}>{msg[0]}</p>}
      <p className="muted small">The code changes every few seconds, so a photo of it will not work.</p>
      <Link className="btn ghost" to="/">Back to events</Link>
    </div>
  )
}
