import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

const DEPARTMENTS = ['AI&DS', 'CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other']
const deptClass = (d) => ({
  'AI&DS': 'ds', CSE: 'cse', IT: 'it', ECE: 'ece', EEE: 'ece', Mechanical: 'mech', Civil: 'other', Other: 'other',
}[d] || 'other')

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

  const complete = user.profileComplete

  return (
    <div className="page-narrow">
      <div className="tag" style={{ marginBottom: 10 }}>// IDENTITY</div>
      <h1>{complete ? 'Your profile.' : 'Finish your student profile.'}</h1>
      <p className="muted">We remember this. You only fill it once — registering for events is one tap after this.</p>

      <form className="card stack" onSubmit={submit} style={{ marginTop: 24 }}>
        <div className="field">
          <span className="label">Email</span>
          <input className="input mono" value={user.email} disabled />
        </div>

        <div className="field">
          <span className="label">Full name</span>
          <input className="input" required value={f.name} onChange={set('name')} placeholder="e.g. Karthik Raja" />
        </div>

        <div className="form-grid">
          <div className="field">
            <span className="label">Department</span>
            <select className="select" required value={f.department} onChange={set('department')}>
              <option value="">Select…</option>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            {f.department && <span className={`dept-chip ${deptClass(f.department)}`} style={{ alignSelf: 'flex-start' }}>{f.department}</span>}
          </div>
          <div className="field">
            <span className="label">Year</span>
            <select className="select" required value={f.year} onChange={set('year')}>
              <option value="">Select…</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="label">Roll number</span>
          <input className="input mono" required value={f.roll_no} onChange={set('roll_no')} placeholder="e.g. 22AD001" />
        </div>

        {error && <p className="err-text">{error}</p>}

        <div className="row between" style={{ marginTop: 8 }}>
          {complete
            ? <button type="button" className="btn btn-ghost" onClick={() => nav(-1)}>Cancel</button>
            : <span className="tag">[required]</span>
          }
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save and continue →'}</button>
        </div>
      </form>
    </div>
  )
}
