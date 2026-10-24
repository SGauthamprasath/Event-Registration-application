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
  wrong_event: ['That QR is for a different event. Check you opened the right event.', 'error'],
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
  const readerRef = useRef(null)
  // Real camera zoom (not page zoom), when the phone's camera exposes it: { min, max, step }.
  const [zoomCaps, setZoomCaps] = useState(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)

  const canScan = ev && ev.registered && ev.attendance_open && !ev.attended
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
      .start({ facingMode: 'environment' }, {
        fps: 10,
        aspectRatio: 1,
        // Scan area follows the box size: most of the view on any phone, not a fixed 240px.
        qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s } },
      }, onScan, () => {})
      .then(() => {
        if (cancelled) return
        try {
          const caps = scanner.getRunningTrackCapabilities()
          if (caps.zoom && caps.zoom.max > caps.zoom.min) {
            const start = scanner.getRunningTrackSettings().zoom || caps.zoom.min
            zoomRef.current = start
            setZoom(start)
            setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 })
          }
        } catch { /* no zoom on this camera */ }
      })
      .catch(() => !cancelled && setCamError('Camera not available. Allow camera access and make sure the site is on HTTPS.'))

    return () => {
      cancelled = true
      setZoomCaps(null)
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [canScan, done, id])

  // Pinch on the camera box zooms the camera. Native non-passive listeners so preventDefault
  // stops the browser from zooming the whole page instead.
  useEffect(() => {
    const el = readerRef.current
    if (!el || !zoomCaps) return
    let startDist = 0, startZoom = 1, frame = 0
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      startDist = dist(e.touches); startZoom = zoomRef.current
    }
    const onMove = (e) => {
      if (e.touches.length !== 2 || !startDist) return
      e.preventDefault()
      const next = startZoom * (dist(e.touches) / startDist)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => applyZoom(next))
    }
    const onEnd = (e) => { if (e.touches.length < 2) startDist = 0 }
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [zoomCaps])

  function applyZoom(value) {
    if (!zoomCaps || !scannerRef.current) return
    const v = Math.min(zoomCaps.max, Math.max(zoomCaps.min, value))
    zoomRef.current = v
    setZoom(v)
    scannerRef.current.applyVideoConstraints({ advanced: [{ zoom: v }] }).catch(() => {})
  }

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
      {ev.registered && ev.status === 'upcoming' && !ev.attendance_open && <div className="result warn">This event has not started. Attendance opens at the start time.</div>}
      {ev.registered && ev.status !== 'upcoming' && !ev.attendance_open && !ev.attended && <div className="result error"><div className="icon"><X /></div>Attendance is closed.</div>}
      {(ev.attended || done) && <div className="result ok"><div className="icon"><Check /></div>Your attendance is marked.</div>}

      {canScan && !done && (
        <>
          <div className="reader" ref={readerRef}><span /><div id="reader" /></div>
          {zoomCaps && (
            <div className="zoom-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyZoom(zoom - (zoomCaps.max - zoomCaps.min) / 10)} aria-label="Zoom out">−</button>
              <input type="range" className="zoom-range" min={zoomCaps.min} max={zoomCaps.max} step={zoomCaps.step}
                value={zoom} onChange={(e) => applyZoom(Number(e.target.value))} aria-label="Camera zoom" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyZoom(zoom + (zoomCaps.max - zoomCaps.min) / 10)} aria-label="Zoom in">+</button>
              <span className="tag zoom-val">{zoom.toFixed(1)}×</span>
            </div>
          )}
          <div className="tag" style={{ textAlign: 'center' }}>{zoomCaps ? 'Pinch or slide to zoom  ·  Auto-submits on read' : 'Point at the projector QR  ·  Auto-submits on read'}</div>
          {camError && <p className="err-text">{camError}</p>}
        </>
      )}

      {msg && !done && (
        <div className={`result ${msg[1]}`}>
          <div className="icon">{msg[1] === 'ok' ? <Check /> : <X />}</div>
          {msg[0]}
        </div>
      )}

      <p className="muted small" style={{ textAlign: 'center' }}>The code changes every 15 seconds, so a photo won't work.</p>

      <Link className="btn btn-ghost btn-block" to="/"><Back style={{ width: 14, height: 14 }} /> Back to events</Link>
    </div>
  )
}
