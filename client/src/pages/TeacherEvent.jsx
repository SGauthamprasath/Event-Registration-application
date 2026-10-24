import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api, downloadCsv } from '../api.js'
import { fmtHour, useEvents } from '../useEvents.js'
import { Back, Clock, Download, Hourglass, MapPin, Maximize, Pencil, Users } from '../icons.jsx'

function useRotatingQr(eventId, enabled) {
  const [qr, setQr] = useState(null)
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    if (!enabled) { setQr(null); return }
    let timer, stop = false
    // Show the current code, flip to the pre-sent next one the moment it becomes valid, then
    // fetch again in the background for the one after. The switch never waits on the network.
    async function tick() {
      try {
        const sent = Date.now()
        const d = await api(`/events/${eventId}/qr`)
        if (stop) return
        setClosed(false)
        if (!d.next) { setQr(d); timer = setTimeout(tick, d.expiresInMs); return }
        // Half the round trip is roughly how stale expiresInMs already is.
        const flipIn = Math.max(0, d.expiresInMs - (Date.now() - sent) / 2)
        // barDelay starts the countdown bar part-way through when we join mid-window. A refetch of
        // the code already on screen keeps the old value, or the running bar would jump.
        setQr((prev) => prev?.token === d.token ? { ...d, barDelay: prev.barDelay } : { ...d, barDelay: flipIn - d.windowMs })
        timer = setTimeout(() => {
          if (stop) return
          setQr({ ...d, token: d.next, barDelay: 0 })
          timer = setTimeout(tick, 1000) // fetch after the server is safely into the new slot
        }, flipIn)
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

const fmtElapsed = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export default function TeacherEvent() {
  const { id } = useParams()
  const { events, reload } = useEvents()
  const ev = events.find((e) => e.id === Number(id))
  const { qr, closed } = useRotatingQr(id, !!ev?.attendance_open)
  const [stats, setStats] = useState(null)
  const [roll, setRoll] = useState('')
  const [manualMsg, setManualMsg] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [toggleErr, setToggleErr] = useState('')
  const stage = useRef(null)

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const d = await api(`/events/${id}/stats`)
        if (!stop) setStats(d)
      } catch {}
    }
    load()
    const t = setInterval(load, 5000)
    return () => { stop = true; clearInterval(t) }
  }, [id])

  async function manual(e) {
    e.preventDefault()
    setManualMsg(null)
    try {
      const d = await api(`/events/${id}/manual`, { method: 'POST', body: { roll_no: roll } })
      setManualMsg({ ok: d.status === 'marked', text: d.status === 'marked' ? `Marked ${d.student.name} (${d.student.roll_no})` : `${d.student.name} was already marked` })
      setRoll('')
    } catch (err) {
      setManualMsg({ ok: false, text: err.data?.status === 'not_registered' ? 'Roll number is not registered for this event' : err.message })
    }
  }

  async function toggleRegistration() {
    setToggling(true); setToggleErr('')
    try {
      await api(`/events/${id}/registration`, { method: 'POST', body: { open: !ev.registration_open } })
      await reload()
    } catch (err) {
      setToggleErr(err.message)
    }
    setToggling(false)
  }

  async function toggleAttendance() {
    setToggling(true); setToggleErr('')
    try {
      await api(`/events/${id}/attendance`, { method: 'POST', body: { open: !ev.attendance_open } })
      await reload()
    } catch (err) {
      setToggleErr(err.message)
    }
    setToggling(false)
  }

  if (!ev) return <p className="loading">Loading…</p>

  const elapsed = ev.status === 'live' ? Date.now() - Date.parse(ev.starts_at) : 0
  const verifiedPct = stats && stats.registered ? Math.round((stats.attended / stats.registered) * 100) : 0

  return (
    <div className="console">
      <div className="row" style={{ gap: 10 }}>
        <Link to="/" className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Back style={{ width: 14, height: 14 }} /> Back to events</Link>
      </div>

      <div className="op-head">
        <div className="left">
          <div className="pills">
            <span className={`status-pill ${ev.status}`}>
              {ev.status === 'live' && <i className="dot pulse" />}
              {ev.status === 'live' ? 'Live' : ev.status === 'upcoming' ? 'Upcoming' : 'Ended'}
            </span>
            {ev.status === 'live' && <span className="tag" style={{ color: 'var(--ink-2)' }}><Clock style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> {fmtElapsed(elapsed)} elapsed</span>}
            <span className="tag"><MapPin style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> {ev.venue || 'TBA'}</span>
          </div>
          <h1>{ev.title}</h1>
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => stage.current?.requestFullscreen?.()}><Maximize /> Fullscreen for projector</button>
          <button className="btn btn-ghost" onClick={() => downloadCsv(ev.id, ev.title)}><Download /> Download CSV</button>
          <button className={`btn ${ev.attendance_open ? 'btn-ghost' : 'btn-live'}`} onClick={toggleAttendance} disabled={toggling}>
            {toggling ? 'Saving…' : ev.attendance_open ? 'Close attendance now' : 'Open attendance now'}
          </button>
          <button className={`btn ${ev.registration_open ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleRegistration} disabled={toggling}>
            {toggling ? 'Saving…' : ev.registration_open ? 'Close registration' : 'Open registration'}
          </button>
          {toggleErr && <p className="err-text">{toggleErr}</p>}
        </div>
      </div>

      <div className="op-body">
        {/* LEFT: QR stage */}
        <div className="qr-stage" ref={stage}>
          {ev.attendance_open && qr && !closed ? (
            <div className="qs-well">
              <div className="qr-tile">
                <QRCodeSVG value={qr.token} size={320} marginSize={0} />
              </div>
              {qr.windowMs > 0 && (
                <div className="qr-bar" aria-hidden>
                  <i key={qr.token} style={{ animationDuration: `${qr.windowMs}ms`, animationDelay: `${qr.barDelay || 0}ms` }} />
                </div>
              )}

            </div>
          ) : (
            <div className="qs-closed">
              <div className="ttl">
                {ev.status === 'upcoming' ? `Attendance opens at ${fmtHour(ev.starts_at)}` : 'Attendance closed'}
              </div>
              <div className="muted small">{ev.status === 'upcoming' ? 'The QR appears here when the event goes live, or use "Open attendance now".' : 'Use "Open attendance now" to reopen it, or download the CSV for the final roster.'}</div>
            </div>
          )}

          <div className="qs-note">
            <span className="muted small">{qr && qr.windowMs === 0
              ? 'This code stays the same for the whole session. Students scan it from their phone in the hall.'
              : "The code keeps changing, so a photo of it won't work. Students scan it from their phone in the hall."}</span>
          </div>
        </div>

        {/* RIGHT: stats + override */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="stat-row">
            <div className="stat">
              <div className="k"><span>Registered</span><Users style={{ width: 14, height: 14 }} /></div>
              <div className="v">{stats?.registered ?? ev.registered_count ?? 0}</div>
              <div className="u">students</div>
            </div>
            <div className="stat live">
              <div className="k"><span style={{ color: 'var(--live)' }}>Attended</span>{ev.status === 'live' && <i className="dot pulse" style={{ color: 'var(--live)' }} />}</div>
              <div className="v">{stats?.attended ?? ev.checked_in ?? 0}</div>
              <div className="u">{verifiedPct}% turnout</div>
            </div>
            <div className="stat">
              <div className="k"><span>Absent</span><Hourglass style={{ width: 14, height: 14 }} /></div>
              <div className="v">{stats?.absent ?? Math.max(0, (ev.registered_count || 0) - (ev.checked_in || 0))}</div>
              <div className="u">yet to check in</div>
            </div>
          </div>

          <form className="override" onSubmit={manual}>
            <div className="oh">
              <span className="tag ink-2">Manual check-in</span>
              <span className="tag">For a dead phone</span>
            </div>
            <div className="input-group">
              <input className="input mono" required placeholder="Roll number (e.g. 22AD001)" value={roll} onChange={(e) => setRoll(e.target.value)} />
              <button className="btn btn-live btn-sm" style={{ marginLeft: 'auto' }}>Mark present</button>
            </div>
            {manualMsg && <p className={manualMsg.ok ? 'ok-text' : 'err-text'}>{manualMsg.ok ? '✓ ' : ''}{manualMsg.text}</p>}
            <p className="muted small" style={{ margin: 0 }}>The student must be registered for this event.</p>
          </form>

          <Link to={`/teacher/events/${ev.id}/edit`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}><Pencil /> Edit event / change times</Link>
        </div>
      </div>
    </div>
  )
}
