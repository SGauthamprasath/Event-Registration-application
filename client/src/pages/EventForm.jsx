import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'

// <input type="datetime-local"> has NO time zone: "2026-10-22T10:00" means whatever zone the browser is in.
// new Date(value) reads it in the teacher's own zone (IST), and toISOString() converts to UTC for the server.
// Skipping this is the classic bug that shifts every event by 5h30m.
const toUtc = (local) => (local ? new Date(local).toISOString() : '')
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function EventForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [f, setF] = useState({ title: '', description: '', venue: '', brochure_url: '', starts_at: '', ends_at: '', attendance_closes_at: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (!id) return
    api('/events').then((d) => {
      const ev = d.events.find((e) => e.id === Number(id))
      if (ev) setF({
        title: ev.title, description: ev.description || '', venue: ev.venue || '', brochure_url: ev.brochure_url || '',
        starts_at: toLocalInput(ev.starts_at), ends_at: toLocalInput(ev.ends_at), attendance_closes_at: toLocalInput(ev.attendance_closes_at),
      })
    })
  }, [id])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const body = { ...f, starts_at: toUtc(f.starts_at), ends_at: toUtc(f.ends_at), attendance_closes_at: toUtc(f.attendance_closes_at) }
    try {
      if (id) await api(`/events/${id}`, { method: 'PUT', body })
      else await api('/events', { method: 'POST', body })
      nav('/')
    } catch (err) { setError(err.message) }
  }

  return (
    <form className="card narrow stack" onSubmit={submit}>
      <h1>{id ? 'Edit event' : 'New event'}</h1>
      <label>Title<input required value={f.title} onChange={set('title')} /></label>
      <label>Description<textarea rows={3} value={f.description} onChange={set('description')} /></label>
      <label>Venue<input value={f.venue} onChange={set('venue')} /></label>
      <label>Brochure image link (https://…)<input type="url" value={f.brochure_url} onChange={set('brochure_url')} /></label>
      <label>Starts<input required type="datetime-local" value={f.starts_at} onChange={set('starts_at')} /></label>
      <label>Ends<input required type="datetime-local" value={f.ends_at} onChange={set('ends_at')} /></label>
      <label>Attendance closes (optional, defaults to the end time)
        <input type="datetime-local" value={f.attendance_closes_at} onChange={set('attendance_closes_at')} />
      </label>
      <p className="muted small">Status switches by itself: Upcoming until the start time, Live until the end time, then Ended. To end early or extend, edit the end time.</p>
      {error && <p className="error">{error}</p>}
      <button>{id ? 'Save changes' : 'Create event'}</button>
    </form>
  )
}
