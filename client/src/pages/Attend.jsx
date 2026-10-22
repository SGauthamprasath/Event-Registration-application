import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { api, getDeviceId } from '../api.js'
import { useEvents } from '../useEvents.js'
import { Back, Check, X } from '../icons.jsx'

const MESSAGES = {
  marked: ['Attendance marked', 'ok'],
  duplicate: ['You are already marked present', 'ok'],
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
  const [result, setResult] = useState(null)
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
      if (busy.current) return
      busy.current = true
      try {
        const d = await api(`/events/${id}/attend`, { method: 'POST', body: { token: text, deviceId: getDeviceId() } })
        setResult(d)
      } catch (e) {
        setResult({ status: e.data?.status || 'error', message: e.message })
      }
      setTimeout(() => { busy.current = false }, 1500)
    }

    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, () => {})
      .catch(() => !cancelled && setCamError('Camera not available. Allow camera access and make sure the site is on HTTPS.'))

    return () => {
      cancelled = true
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [canScan, done, id])

  if (loading) return <p className="loading">// Fetching event…</p>
  if (!ev) return <div className="scanner-wrap"><p className="err-text">Event not found.</p><Link className="btn btn-ghost" to="/">Back</Link></div>

  const msg = result && (MESSAGES[result.status] || [result.message || 'Something went wrong', 'error'])

  return (
    <div className="scanner-wrap stack">
      <Link to="/" className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Back style={{ width: 14, height: 14 }} /> Back to hub</Link>

      <div className="tag">// CHECK-IN</div>
      <h1>Scan the stage QR.</h1>
      <div className="muted small">{ev.title}</div>

      {!ev.registered && <div className="result error"><div className="icon"><X /></div>You are not registered for this event.</div>}
      {ev.registered && ev.status === 'upcoming' && <div className="result warn">This event has not started. Attendance opens at the start time.</div>}
      {ev.registered && ev.status !== 'upcoming' && !ev.attendance_open && !ev.attended && <div className="result error"><div className="icon"><X /></div>Attendance is closed.</div>}
      {(ev.attended || done) && <div className="result ok"><div className="icon"><Check /></div>Your attendance is marked.</div>}

      {canScan && !done && (
        <>
          <div className="reader"><span /><div id="reader" /></div>
          <div className="tag" style={{ textAlign: 'center' }}>Point at the projector QR  ·  Auto-submits on read</div>
          {camError && <p className="err-text">{camError}</p>}
        </>
      )}

      {msg && !done && (
        <div className={`result ${msg[1]}`}>
          <div className="icon">{msg[1] === 'ok' ? <Check /> : <X />}</div>
          {msg[0]}
        </div>
      )}

      <p className="muted small" style={{ textAlign: 'center' }}>The code rotates every ~20 seconds, so a photo won't work.</p>

      <Link className="btn btn-ghost btn-block" to="/"><Back style={{ width: 14, height: 14 }} /> Back to events</Link>
    </div>
  )
}
