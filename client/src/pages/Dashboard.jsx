import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useEvents } from '../useEvents.js'
import { Clock, MapPin, Plus, QrCode, Users, Zap } from '../icons.jsx'

const LABEL = { upcoming: 'Upcoming', live: 'Live', ended: 'Ended' }
const deptClass = (d) => ({
  'AI&DS': 'ds', CSE: 'cse', IT: 'it', ECE: 'ece', EEE: 'ece', Mechanical: 'mech', Civil: 'other', Other: 'other',
}[d] || 'other')

function useCountUp(target, dur = 900) {
  const [n, setN] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    let raf
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(begin + (target - begin) * eased))
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return n
}

const dateLabel = (iso) => {
  const d = new Date(iso); const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (sameDay) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })
}
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })

function FeatureEvent({ ev, isTeacher, onRegistered }) {
  const [busy, setBusy] = useState(false)
  async function register() {
    setBusy(true)
    try { await api(`/events/${ev.id}/register`, { method: 'POST' }); await onRegistered() } catch {}
    setBusy(false)
  }
  const live = ev.status === 'live'

  return (
    <article className="feature-event">
      {ev.brochure_url && <div className="bg" style={{ backgroundImage: `url(${ev.brochure_url})` }} />}
      <div className="fe-top">
        <div className="row" style={{ gap: 10 }}>
          <span className={`pill ${live ? 'live' : 'primary'}`}>
            {live && <i className="dot pulse" />}
            {live ? 'Live now' : 'Up next'}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="fe-meta">
          <span><MapPin style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {ev.venue || 'TBA'}</span>
          <span><Clock style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {dateLabel(ev.starts_at)} · {timeLabel(ev.starts_at)} – {timeLabel(ev.ends_at)} IST</span>
        </div>
        <h1><Link to={`/events/${ev.id}`} style={{ color: 'inherit' }}>{ev.title}</Link></h1>
        {ev.description && <p className="fe-desc">{ev.description}</p>}

        <div className="fe-foot">
          <div className="fe-cap">
            <div className="lbl">
              <span>{live ? 'Attendance' : 'Registrations'}</span>
              <span>{live ? `${ev.checked_in} checked in / ${ev.registered_count} registered` : `${ev.registered_count} registered`}</span>
            </div>
            {live && ev.registered_count > 0 && (
              <div className="progress"><span style={{ width: Math.min(100, Math.round(100 * ev.checked_in / ev.registered_count)) + '%' }} /></div>
            )}
          </div>
          <div className="fe-actions">
            <Link className="btn btn-ghost" to={`/events/${ev.id}`}>View details</Link>
            {isTeacher ? (
              <Link className="btn btn-primary" to={`/teacher/events/${ev.id}`}><QrCode /> Open control room</Link>
            ) : (
              <>
                {ev.status === 'upcoming' && (ev.registered
                  ? <span className="pill ok"><i className="dot" />Registered</span>
                  : <button className="btn btn-primary" onClick={register} disabled={busy}>{busy ? 'Registering…' : 'Register'}</button>)}
                {live && ev.registered && !ev.attended && ev.attendance_open && (
                  <Link className="btn btn-live" to={`/events/${ev.id}/attend`}><QrCode /> Mark attendance</Link>
                )}
                {live && ev.attended && <span className="pill ok"><i className="dot" />Attendance marked</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

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
    <article className="event-card">
      <div className="ec-media">
        {ev.brochure_url
          ? <img src={ev.brochure_url} alt="" loading="lazy" />
          : <div className="ec-placeholder">{(ev.title[0] || '•').toUpperCase()}</div>}
        <div className="ec-top">
          <span className={`pill ${ev.status === 'live' ? 'live' : ev.status === 'upcoming' ? 'primary' : 'ghost'}`}>
            {ev.status === 'live' && <i className="dot pulse" />}
            {LABEL[ev.status]}
          </span>
          <span className="pill ghost">{ev.registered_count} registered</span>
        </div>
      </div>
      <div className="ec-body">
        <div className="ec-meta">{dateLabel(ev.starts_at)} · {timeLabel(ev.starts_at)} IST · {ev.venue || 'TBA'}</div>
        <h3 className="ec-title"><Link to={`/events/${ev.id}`} style={{ color: 'inherit' }}>{ev.title}</Link></h3>
        {ev.description && <p className="ec-desc">{ev.description}</p>}
        <div className="ec-foot">
          {!isTeacher ? (
            <>
              <Link className="btn btn-ghost btn-sm" to={`/events/${ev.id}`}>Details</Link>
              {ev.status === 'upcoming' && !ev.registered && (
                <button className="btn btn-primary btn-sm" onClick={register} disabled={busy}>{busy ? '…' : 'Register'}</button>
              )}
              {ev.status === 'upcoming' && ev.registered && (
                <span className="ec-status-text ok">Registered</span>
              )}
              {ev.status === 'live' && ev.registered && !ev.attended && ev.attendance_open && (
                <Link className="btn btn-live btn-sm" to={`/events/${ev.id}/attend`}>Mark present</Link>
              )}
              {ev.status === 'live' && ev.attended && <span className="ec-status-text ok">Attended</span>}
              {ev.status === 'ended' && (ev.attended ? <span className="ec-status-text ok">You attended</span> : ev.registered ? <span className="ec-status-text">Not marked</span> : <span className="ec-status-text">Ended</span>)}
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to={`/events/${ev.id}`}>Details</Link>
              <div className="row" style={{ gap: 8 }}>
                <Link className="btn btn-ghost btn-sm" to={`/teacher/events/${ev.id}/edit`}>Edit</Link>
                <Link className="btn btn-primary btn-sm" to={`/teacher/events/${ev.id}`}>Open</Link>
              </div>
            </>
          )}
        </div>
        {msg && <p className="err-text">{msg}</p>}
      </div>
    </article>
  )
}

function PassCard({ user }) {
  const token = `${user.roll_no || user.email}`
  return (
    <div className="pass">
      <div className="pass-head">
        <div className="ttl">
          <div className="logo-sq" style={{ width: 30, height: 30 }}><Zap /></div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, textTransform: 'uppercase' }}>Student Pass</div>
            <div className="pass-sub">PSG iTech · AI &amp; DS</div>
          </div>
        </div>
      </div>

      <div className="pass-id">
        <div style={{ minWidth: 0 }}>
          <div className="tag">Cardholder</div>
          <div className="n" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.email.split('@')[0]}</div>
          <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.department ? `${user.department}${user.year ? ` · Year ${user.year}` : ''}` : user.email}
          </div>
        </div>
        {user.roll_no && (
          <div style={{ textAlign: 'right' }}>
            <div className="tag">Roll</div>
            <div className="r">{user.roll_no}</div>
          </div>
        )}
      </div>

      <div className="pass-qr">
        <div className="qr-tile"><QRCodeSVG value={token} size={180} marginSize={0} /></div>
      </div>
      <div className="pass-token">{token}</div>
    </div>
  )
}

function VenueGrid({ events }) {
  const venues = useMemo(() => {
    const map = new Map()
    for (const e of events) {
      const v = e.venue || 'TBA'
      if (!map.has(v)) map.set(v, [])
      map.get(v).push(e)
    }
    return [...map.entries()]
  }, [events])

  if (!venues.length) return null

  return (
    <div className="venue-card">
      <div className="vc-head">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Venues</div>
      </div>
      <div className="vc-rows">
        {venues.map(([venue, list]) => {
          const live = list.some((e) => e.status === 'live')
          const upcoming = list.filter((e) => e.status === 'upcoming').length
          return (
            <div className="vc-row" key={venue}>
              <div className="vr-dot" style={{ color: live ? 'var(--live)' : upcoming ? 'var(--primary)' : 'var(--muted)' }}><MapPin style={{ width: 16, height: 16 }} /></div>
              <div className="vr-main">
                <div className="n">{venue}</div>
                <div className="s">{list.length} event{list.length > 1 ? 's' : ''}{upcoming ? ` · ${upcoming} upcoming` : ''}</div>
              </div>
              {live && <span className="pill live"><i className="dot pulse" />Live</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ filter }) {
  const { user } = useAuth()
  const { events, loading, error, reload } = useEvents()
  const isTeacher = user.role === 'teacher'
  const [tab, setTab] = useState('all')

  const live = events.filter((e) => e.status === 'live')
  const upcoming = events.filter((e) => e.status === 'upcoming')
  const ended = events.filter((e) => e.status === 'ended')
  const mine = events.filter((e) => e.registered)

  let shown = events
  if (filter === 'mine') shown = mine
  else if (filter === 'schedule') shown = [...upcoming, ...live].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  else if (tab === 'live') shown = live
  else if (tab === 'upcoming') shown = upcoming
  else if (tab === 'mine') shown = mine
  else if (tab === 'ended') shown = ended

  const feature = live[0] || upcoming[0]
  const grid = shown.filter((e) => e.id !== feature?.id)

  const heroHeading = filter === 'mine' ? 'My Registrations.' : filter === 'schedule' ? 'Schedule.' : null

  const liveN = useCountUp(live.length)
  const upcomingN = useCountUp(upcoming.length)
  const mineN = useCountUp(mine.length)

  return (
    <>
      <section className="hero">
        <div>
          {heroHeading
            ? <h1 className="hero-title"><span className="hero-line" style={{ '--d': '60ms' }}>{heroHeading}</span></h1>
            : (
              <>
                <div className="tag tag-line">Industry Academia Conclave 2026</div>
                <h1 className="hero-title">
                  <span className="hero-line" style={{ '--d': '80ms' }}>Events</span>
                  <span className="hero-line" style={{ '--d': '180ms' }}>on <span className="accent">Campus.</span></span>
                </h1>
                <p className="lede">Register for talks and workshops, and mark attendance in the hall by scanning the QR shown on the projector.</p>
              </>
            )}
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="k">Live now</div>
            <div className={`v ${live.length ? 'ok' : ''}`}>{liveN}</div>
            <div className="u">{live.length === 1 ? 'event' : 'events'}</div>
          </div>
          <div className="hero-stat">
            <div className="k">Upcoming</div>
            <div className="v">{upcomingN}</div>
            <div className="u">scheduled</div>
          </div>
          {isTeacher
            ? <Link to="/teacher/events/new" className="hero-cta"><Plus /> New event</Link>
            : (
              <div className="hero-stat">
                <div className="k">Your registrations</div>
                <div className="v">{mineN}</div>
                <div className="u">events</div>
              </div>
            )}
        </div>
      </section>

      <div className="filter-row" style={{ marginBottom: 20 }}>
        <button className={`filter-chip ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All <span className="count">({events.length})</span></button>
        <button className={`filter-chip live ${tab === 'live' ? 'active' : ''}`} onClick={() => setTab('live')}>
          {live.length > 0 && <i className="dot pulse" />}Live <span className="count">({live.length})</span>
        </button>
        <button className={`filter-chip ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>Upcoming <span className="count">({upcoming.length})</span></button>
        <button className={`filter-chip ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>Registered <span className="count">({mine.length})</span></button>
        <button className={`filter-chip ${tab === 'ended' ? 'active' : ''}`} onClick={() => setTab('ended')}>Ended <span className="count">({ended.length})</span></button>
      </div>

      {loading && <p className="loading">Loading events…</p>}
      {error && <p className="err-text">{error}</p>}

      <div className="hub-grid">
        <div>
          {feature && <FeatureEvent ev={feature} isTeacher={isTeacher} onRegistered={reload} />}

          {grid.length > 0 && (
            <div className="section-divider">
              <span className="label">All events</span>
              <span className="line" />
              <span className="label">{grid.length}</span>
            </div>
          )}

          <div className="event-grid">
            {grid.map((ev) => <EventCard key={ev.id} ev={ev} isTeacher={isTeacher} onRegistered={reload} />)}
          </div>

          {!loading && !events.length && (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <h2>No events yet.</h2>
              <p className="muted">{isTeacher ? 'Create the first event with + New event.' : 'Check back later — new events show up here as teachers add them.'}</p>
            </div>
          )}
        </div>

        <aside className="stack" style={{ gap: 20 }}>
          {user.role === 'student' && <PassCard user={user} />}
          <VenueGrid events={events} />
        </aside>
      </div>
    </>
  )
}
