import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { Back, Trash } from '../icons.jsx'

// Shrink the picked image in the browser before upload: at most 1200 px wide, WebP (JPEG on
// browsers that can't encode WebP). A 5 MB phone photo becomes ~200 KB.
const MAX_W = 1200
async function compressImage(file) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_W / bmp.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const encode = (type, q) => new Promise((ok) => canvas.toBlob(ok, type, q))
  let blob = await encode('image/webp', 0.82)
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.85)
  if (!blob) throw new Error('Could not read that image')
  return blob
}

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
  const [saving, setSaving] = useState(false)
  const [image, setImage] = useState(null) // { blob, preview } waiting to upload on save
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

  useEffect(() => () => image && URL.revokeObjectURL(image.preview), [image])

  async function pickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('Pick an image file (JPG, PNG or WebP).')
    try {
      const blob = await compressImage(file)
      setImage({ blob, preview: URL.createObjectURL(blob) })
    } catch (err) { setError(err.message) }
  }

  // The image is only uploaded on save, so a cancelled form leaves nothing in storage.
  async function submit(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    let uploaded = null
    try {
      if (image) uploaded = (await api('/brochures', { method: 'POST', body: image.blob })).url
      const body = {
        ...f, brochure_url: uploaded || f.brochure_url,
        starts_at: toUtc(f.starts_at), ends_at: toUtc(f.ends_at), attendance_closes_at: toUtc(f.attendance_closes_at),
      }
      if (id) await api(`/events/${id}`, { method: 'PUT', body })
      else await api('/events', { method: 'POST', body })
      nav('/')
    } catch (err) {
      if (uploaded) api('/brochures', { method: 'DELETE', body: { url: uploaded } }).catch(() => {})
      setError(err.message)
    }
    setSaving(false)
  }

  async function onDelete() {
    if (!confirm('Delete this event? This cannot be undone.')) return
    try { await api(`/events/${id}`, { method: 'DELETE' }); nav('/') }
    catch (err) { setError(err.message) }
  }

  const endsBeforeStart = f.starts_at && f.ends_at && new Date(f.ends_at) <= new Date(f.starts_at)

  return (
    <div className="page-narrow" style={{ maxWidth: 820 }}>
      <Link to="/" className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}><Back style={{ width: 14, height: 14 }} /> Back to events</Link>

      <div className="tag" style={{ marginBottom: 10 }}>// EVENT COMPOSER</div>
      <h1>{id ? 'Edit stage event.' : 'New stage event.'}</h1>
      <p className="muted">Status switches by itself: Upcoming until the start time, Live until the end time, then Ended.</p>

      <form className="card stack" onSubmit={submit} style={{ marginTop: 24 }}>
        <div className="field">
          <span className="label">Title</span>
          <input className="input" required value={f.title} onChange={set('title')} placeholder="AI & Agentic Systems Symposium 2025" />
        </div>

        <div className="field">
          <span className="label">Description</span>
          <textarea className="textarea" rows={4} value={f.description} onChange={set('description')} placeholder="Short pitch shown on the card." />
        </div>

        <div className="form-grid">
          <div className="field">
            <span className="label">Venue</span>
            <input className="input" value={f.venue} onChange={set('venue')} placeholder="Newton Hall" />
          </div>
          <div className="field">
            <span className="label">Brochure image</span>
            <label className="btn btn-ghost" style={{ justifyContent: 'center', cursor: 'pointer' }}>
              {image || f.brochure_url ? 'Change image' : 'Choose image'}
              <input type="file" accept="image/*" onChange={pickImage} hidden />
            </label>
            <span className="help">JPG, PNG or WebP. It's resized before upload.</span>
          </div>
        </div>

        {(image || f.brochure_url) && (
          <div className="card-inset" style={{ padding: 10, maxWidth: 260 }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="tag">Preview{image ? ' · not saved yet' : ''}</span>
              <button type="button" className="btn-link small" onClick={() => { setImage(null); setF({ ...f, brochure_url: '' }) }}>Remove</button>
            </div>
            <img src={image ? image.preview : f.brochure_url} alt="" style={{ width: '100%', borderRadius: 10 }} />
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <span className="label">Starts at</span>
            <input className="input mono" required type="datetime-local" value={f.starts_at} onChange={set('starts_at')} />
          </div>
          <div className="field">
            <span className="label">Ends at</span>
            <input className={`input mono ${endsBeforeStart ? 'err' : ''}`} required type="datetime-local" value={f.ends_at} onChange={set('ends_at')} />
            {endsBeforeStart && <span className="err">[ERR] ENDS BEFORE STARTS</span>}
          </div>
        </div>

        <div className="field">
          <span className="label">Attendance closes at (optional)</span>
          <input className="input mono" type="datetime-local" value={f.attendance_closes_at} onChange={set('attendance_closes_at')} />
          <span className="help">Defaults to the event end time.</span>
        </div>

        <div className="tag" style={{ color: 'var(--muted)' }}>[LOCAL TZ · AUTO-CONVERTED TO UTC ON SAVE]</div>

        {error && <p className="err-text">{error}</p>}

        <div className="row between" style={{ marginTop: 10 }}>
          {id
            ? <button type="button" className="btn btn-danger" onClick={onDelete}><Trash /> Delete event</button>
            : <Link to="/" className="btn btn-ghost">Cancel</Link>}
          <button className="btn btn-primary" disabled={saving || endsBeforeStart}>{saving ? 'Saving…' : (id ? 'Save changes →' : 'Create event →')}</button>
        </div>
      </form>
    </div>
  )
}
