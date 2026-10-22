import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api, downloadCsv } from '../api.js'
import { fmtHour, useEvents } from '../useEvents.js'

// Rotating QR. We ask the server for the current token and schedule the next fetch for the
// moment it expires, so the code on screen is always fresh.
function useRotatingQr(eventId, enabled) {
  const [qr, setQr] = useState(null)
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    if (!enabled) { setQr(null); return }
    let timer, stop = false
    async function tick() {
      try {
        const d = await api(`/events/${eventId}/qr`)
        if (stop) return
        setQr(d); setClosed(false)
        timer = setTimeout(tick, Math.max(800, d.expiresInMs + 150))
      } catch {
        if (stop) return
        setClosed(true); timer = setTimeout(tick, 3000)
      }
    }
    tick()
    return () => { stop = true; clearTimeout(timer) }
  }, [eventId, enabled])
  return { qr, closed }
}

export default function TeacherEvent() {
  const { id } = useParams()
  const { events } = useEvents()
  const ev = events.find((e) => e.id === Number(id))
  const { qr, closed } = useRotatingQr(id, !!ev?.attendance_open)
  const [stats, setStats] = useState(null)
  const [roll, setRoll] = useState('')
  const [manualMsg, setManualMsg] = useState('')
  const stage = useRef(null)

  useEffect(() => {
    let stop = false
    const load = () => api(`/events/${id}/stats`).then((d) => !stop && setStats(d)).catch(() => {})
    load()
    const t = setInterval(load, 5000)
    return () => { stop = true; clearInterval(t) }
  }, [id])

  async function manual(e) {
    e.preventDefault()
    setManualMsg('')
    try {
      const d = await api(`/events/${id}/manual`, { method: 'POST', body: { roll_no: roll } })
      setManualMsg(d.status === 'marked' ? `✓ Marked ${d.student.name} (${d.student.roll_no})` : `${d.student.name} was already marked`)
      setRoll('')
    } catch (err) { setManualMsg(err.data?.status === 'not_registered' ? 'That roll number is not registered for this event' : err.message) }
  }

  if (!ev) return <p className="muted">Loading…</p>

  return (
    <div className="stack">
      <div className="row between">
        <h1>{ev.title}</h1>
        <span className={`badge ${ev.status}`}>{ev.status}</span>
      </div>

      <div className="card stage" ref={stage}>
        {ev.attendance_open && qr && !closed ? (
          <>
            <QRCodeSVG value={qr.token} size={320} marginSize={2} className="qr" />
            <p className="big"><strong>{ev.checked_in}</strong> checked in</p>
            <p className="muted">Open Campus Events → your event → Mark attendance → scan this code. It refreshes every {Math.round(qr.windowMs / 1000)} s.</p>
          </>
        ) : (
          <p className="big">
            {ev.status === 'upcoming' && `Attendance opens at ${fmtHour(ev.starts_at)}`}
            {ev.status !== 'upcoming' && 'Attendance is closed'}
          </p>
        )}
        <button className="ghost" onClick={() => stage.current?.requestFullscreen?.()}>Full screen for projector</button>
      </div>

      <div className="card">
        <h2>Summary</h2>
        <div className="stats">
          <div><strong>{stats?.registered ?? '–'}</strong><span>Registered</span></div>
          <div><strong>{stats?.attended ?? '–'}</strong><span>Attended</span></div>
          <div><strong>{stats?.absent ?? '–'}</strong><span>Absent</span></div>
        </div>
        <button onClick={() => downloadCsv(ev.id, ev.title)}>Download CSV (registered, attended, absent)</button>
      </div>

      <form className="card stack" onSubmit={manual}>
        <h2>Manual check-in</h2>
        <p className="muted small">For a dead phone or a shared phone. The student must be registered for this event.</p>
        <div className="row">
          <input required placeholder="Roll number" value={roll} onChange={(e) => setRoll(e.target.value)} />
          <button>Mark present</button>
        </div>
        {manualMsg && <p>{manualMsg}</p>}
      </form>

      <Link to={`/teacher/events/${ev.id}/edit`} className="btn ghost">Edit event / change times</Link>
    </div>
  )
}
