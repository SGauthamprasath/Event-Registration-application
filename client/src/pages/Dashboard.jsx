import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { fmtHour, fmtTime, useEvents } from '../useEvents.js'

const LABEL = { upcoming: 'Upcoming', live: 'Live', ended: 'Ended' }

function EventCard({ ev, isTeacher, onRegistered }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function register() {
    setBusy(true); setMsg('')
    try { await api(`/events/${ev.id}/register`, { method: 'POST' }); await onRegistered() }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  return (
    <article className={`card event ${ev.status}`}>
      {ev.brochure_url && <img className="brochure" src={ev.brochure_url} alt={`${ev.title} brochure`} loading="lazy" />}
      <div className="body">
        <div className="row between">
          <span className={`badge ${ev.status}`}>{ev.status === 'live' && <i className="dot" />}{LABEL[ev.status]}</span>
          <span className="muted small">{ev.registered_count} registered</span>
        </div>
        <h2>{ev.title}</h2>
        <p className="muted small">{fmtTime(ev.starts_at)} – {fmtHour(ev.ends_at)}{ev.venue && ` · ${ev.venue}`}</p>
        {ev.description && <p>{ev.description}</p>}

        {/* Live count is visible to everyone while the event is on, and stays as the final number after */}
        {ev.status === 'live' && <p className="count"><strong>{ev.checked_in}</strong> checked in</p>}
        {ev.status === 'ended' && <p className="muted">Ended · {ev.checked_in} attended</p>}

        {!isTeacher && (
          <div className="actions">
            {ev.status === 'upcoming' && (ev.registered
              ? <span className="ok">Registered ✓</span>
              : <button onClick={register} disabled={busy}>{busy ? 'Registering…' : 'Register'}</button>)}
            {ev.status !== 'upcoming' && !ev.registered && <span className="muted small">You did not register for this event</span>}
            {ev.status === 'live' && ev.registered && (ev.attended
              ? <span className="ok">Attendance marked ✓</span>
              : ev.attendance_open
                ? <Link className="btn" to={`/events/${ev.id}/attend`}>Mark attendance</Link>
                : <span className="muted small">Attendance window closed</span>)}
            {ev.status === 'ended' && ev.registered && (ev.attended ? <span className="ok">You attended ✓</span> : <span className="muted small">Not marked present</span>)}
          </div>
        )}
        {isTeacher && (
          <div className="actions">
            <Link className="btn" to={`/teacher/events/${ev.id}`}>Open control room</Link>
            <Link className="btn ghost" to={`/teacher/events/${ev.id}/edit`}>Edit</Link>
          </div>
        )}
        {msg && <p className="error">{msg}</p>}
      </div>
    </article>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { events, loading, error, reload } = useEvents()
  const isTeacher = user.role === 'teacher'

  return (
    <>
      <div className="row between">
        <h1>Events</h1>
        {isTeacher && <Link className="btn" to="/teacher/events/new">+ New event</Link>}
      </div>
      {loading && <p className="muted">Loading events…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !events.length && <p className="muted">No events yet.</p>}
      <div className="grid">
        {events.map((ev) => <EventCard key={ev.id} ev={ev} isTeacher={isTeacher} onRegistered={reload} />)}
      </div>
    </>
  )
}
