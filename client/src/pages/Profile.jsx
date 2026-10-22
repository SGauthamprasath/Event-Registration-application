import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

const DEPARTMENTS = ['AI&DS', 'CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other']

export default function Profile() {
  const { user, setUser } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({
    name: user.name || '', department: user.department || '', year: user.year || '', roll_no: user.roll_no || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const d = await api('/me', { method: 'PUT', body: { ...f, year: Number(f.year) } })
      setUser(d.user)
      nav('/')
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <form className="card narrow stack" onSubmit={submit}>
      <h1>{user.profileComplete ? 'Your profile' : 'Complete your profile'}</h1>
      <p className="muted">Asked once. Registering for events is one tap after this.</p>
      <label>Email<input value={user.email} disabled /></label>
      <label>Full name<input required value={f.name} onChange={set('name')} /></label>
      <label>Department
        <select required value={f.department} onChange={set('department')}>
          <option value="">Select…</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label>Year
        <select required value={f.year} onChange={set('year')}>
          <option value="">Select…</option>
          {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label>Roll number<input required value={f.roll_no} onChange={set('roll_no')} placeholder="e.g. 22AD001" /></label>
      {error && <p className="error">{error}</p>}
      <button disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </form>
  )
}
