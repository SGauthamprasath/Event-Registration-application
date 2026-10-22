import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useEvents, fmtHour } from '../useEvents.js'
import { EVENT_DETAILS } from '../eventDetails.js'
import { Back, Calendar, Clock, MapPin, QrCode, Users } from '../icons.jsx'

const LABEL = { upcoming: 'Upcoming', live: 'Live', ended: 'Ended' }
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
const dateLabel = (iso) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function initialsOf(name) {
  const p = (name || '?').split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase()
}

export default function EventDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { events, loading, reload } = useEvents()
  const ev = events.find((e) => e.id === Number(id))
  const details = EVENT_DETAILS[Number(id)]
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (loading) return <p className="loading">Loading…</p>
  if (!ev) return <div className="card"><p>Event not found. <Link className="btn-link" to="/">Back</Link></p></div>

  const isTeacher = user.role === 'teacher'
  const brochure = ev.brochure_url || details?.brochure

  async function register() {
    setBusy(true); setMsg('')
    try { await api(`/events/${ev.id}/register`, { method: 'POST' }); await reload() }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  return (
    <div className="event-detail">
      <Link to="/" className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Back style={{ width: 14, height: 14 }} /> Back to events
      </Link>

      {/* Hero header */}
      <div className="ed-hero">
        <div className="ed-hero-left">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className={`status-pill ${ev.status}`}>
              {ev.status === 'live' && <i className="dot pulse" />}
              {LABEL[ev.status]}
            </span>
            {details?.track && <span className="pill">{details.track}</span>}
          </div>
          <h1 className="ed-title">{ev.title}</h1>
          {ev.description && <p className="ed-lede">{ev.description}</p>}

          <div className="ed-cta-row">
            {!isTeacher && ev.status === 'upcoming' && (ev.registered
              ? <span className="pill ok"><i className="dot" />You're registered</span>
              : <button className="btn btn-primary" onClick={register} disabled={busy}>{busy ? 'Registering…' : 'Register'}</button>)}
            {!isTeacher && ev.registered && !ev.attended && ev.attendance_open && (
              <Link className="btn btn-live" to={`/events/${ev.id}/attend`}><QrCode /> Mark attendance</Link>
            )}
            {!isTeacher && ev.status !== 'ended' && ev.attended && <span className="pill ok"><i className="dot" />Attendance marked</span>}
            {!isTeacher && ev.status === 'ended' && ev.registered && (
              <span className="pill ok">{ev.attended ? 'You attended' : 'Not marked present'}</span>
            )}
            {isTeacher && <Link className="btn btn-primary" to={`/teacher/events/${ev.id}`}>Open control room</Link>}
            {isTeacher && <Link className="btn btn-ghost" to={`/teacher/events/${ev.id}/edit`}>Edit</Link>}
          </div>
          {msg && <p className="err-text">{msg}</p>}
        </div>

        {brochure && (
          <a href={brochure} target="_blank" rel="noreferrer" className="ed-poster" title="Open full brochure">
            <img src={brochure} alt={`${ev.title} brochure`} />
          </a>
        )}
      </div>

      {/* Detail cards */}
      <div className="ed-grid">
        {/* When */}
        <div className="card detail-card">
          <div className="tag">When</div>
          <div className="dc-row"><Calendar style={{ width: 16, height: 16 }} /><span>{dateLabel(ev.starts_at)}</span></div>
          <div className="dc-row"><Clock style={{ width: 16, height: 16 }} /><span>{timeLabel(ev.starts_at)} – {timeLabel(ev.ends_at)} IST</span></div>
          <div className="muted small">Attendance opens at {fmtHour(ev.starts_at)} and closes with the session.</div>
        </div>

        {/* Where */}
        <div className="card detail-card">
          <div className="tag">Where</div>
          <div className="dc-row"><MapPin style={{ width: 16, height: 16 }} /><span>{ev.venue || 'TBA'}</span></div>
          <div className="muted small">PSG Institute of Technology & Applied Research, Coimbatore.</div>
        </div>

        {/* Headcount */}
        <div className="card detail-card">
          <div className="tag">Headcount</div>
          <div className="dc-row"><Users style={{ width: 16, height: 16 }} /><span><b>{ev.registered_count}</b> registered</span></div>
          {ev.status !== 'upcoming' && <div className="dc-row"><i className="dot" style={{ color: 'var(--live)' }} /><span><b>{ev.checked_in}</b> checked in</span></div>}
          <div className="muted small">{details?.audience || 'Open to all students.'}</div>
        </div>

        {/* Organiser */}
        <div className="card detail-card">
          <div className="tag">Organiser</div>
          <div className="dc-row"><span>{details?.organiser || 'Campus Events'}</span></div>
          <div className="muted small">PSG iTech · AI & Data Science Department</div>
        </div>
      </div>

      {/* Speaker card */}
      {details?.speaker && (
        <div className="card speaker-card">
          <div className="tag">Speaker</div>
          <div className="sc-body">
            <div className="sc-avatar">{initialsOf(details.speaker.name)}</div>
            <div className="sc-info">
              <div className="sc-name">{details.speaker.name}</div>
              <div className="sc-role">{details.speaker.role}</div>
              <div className="muted small">{details.speaker.org}</div>
            </div>
            {details.topic && (
              <div className="sc-topic">
                <div className="tag">Topic</div>
                <div className="sc-topic-text">{details.topic}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agenda + Takeaways */}
      <div className="ed-two">
        {details?.agenda && (
          <div className="card">
            <div className="tag" style={{ marginBottom: 14 }}>Agenda</div>
            <ol className="agenda">
              {details.agenda.map(([t, label]) => (
                <li key={t}>
                  <span className="agenda-time">{t}</span>
                  <span className="agenda-label">{label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {details?.takeaways && (
          <div className="card">
            <div className="tag" style={{ marginBottom: 14 }}>What you'll take away</div>
            <ul className="takeaways">
              {details.takeaways.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
