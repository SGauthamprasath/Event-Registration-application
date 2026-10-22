import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadAllStudentsCsv, downloadCsv } from '../api.js'
import { Back, Download, Plus, Users } from '../icons.jsx'

const timeLabel = (iso) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const deptClass = (d) => ({
  'AI&DS': 'ds', CSE: 'cse', IT: 'it', ECE: 'ece', EEE: 'ece', Mechanical: 'mech', Civil: 'other', Other: 'other',
}[d] || 'other')

export default function Admin() {
  const [overview, setOverview] = useState(null)
  const [students, setStudents] = useState([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('events')
  const [err, setErr] = useState('')

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const [o, s] = await Promise.all([api('/admin/overview'), api('/admin/students')])
        if (stop) return
        setOverview(o); setStudents(s.students); setErr('')
      } catch (e) { !stop && setErr(e.message) }
    }
    load()
    const t = setInterval(load, 15000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  if (err && !overview) return <div className="card"><p className="err-text">{err}</p></div>
  if (!overview) return <p className="loading">Loading admin console…</p>

  const filteredStudents = students.filter((s) => {
    if (!q) return true
    const needle = q.toLowerCase()
    return [s.name, s.email, s.roll_no, s.department].some((v) => (v || '').toLowerCase().includes(needle))
  })

  return (
    <div className="admin-page stack" style={{ gap: 32 }}>
      <div className="row" style={{ gap: 10 }}>
        <Link to="/" className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Back style={{ width: 14, height: 14 }} /> Back to events
        </Link>
      </div>

      <div>
        <div className="tag">// ADMIN CONSOLE</div>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>Registrations overview.</h1>
        <p className="muted">Totals across the Industry Academia Conclave 2026. CSVs match what you'll upload to the department record.</p>
      </div>

      <div className="admin-stats">
        <div className="stat">
          <div className="k"><span>Students on platform</span><Users style={{ width: 14, height: 14 }} /></div>
          <div className="v">{overview.totalStudents}</div>
          <div className="u">accounts</div>
        </div>
        <div className="stat">
          <div className="k"><span>Total registrations</span></div>
          <div className="v">{overview.totalRegistrations}</div>
          <div className="u">across all events</div>
        </div>
        <div className="stat live">
          <div className="k"><span style={{ color: 'var(--live)' }}>Marked present</span></div>
          <div className="v">{overview.totalAttendances}</div>
          <div className="u">attendance rows</div>
        </div>
        <div className="stat ok">
          <div className="k"><span>Events</span></div>
          <div className="v">{overview.events.length}</div>
          <div className="u">scheduled</div>
        </div>
      </div>

      <div className="filter-row">
        <button className={`filter-chip ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Events <span className="count">({overview.events.length})</span></button>
        <button className={`filter-chip ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Students <span className="count">({students.length})</span></button>
        <button className={`filter-chip ${tab === 'depts' ? 'active' : ''}`} onClick={() => setTab('depts')}>By department <span className="count">({overview.byDept.length})</span></button>
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={downloadAllStudentsCsv}><Download /> All students CSV</button>
      </div>

      {tab === 'events' && (
        <div className="admin-table">
          <table>
            <thead>
              <tr><th>Event</th><th>When</th><th>Registered</th><th>Attended</th><th>Rate</th><th style={{ textAlign: 'right' }}>CSV</th></tr>
            </thead>
            <tbody>
              {overview.events.map((e) => {
                const rate = e.registered ? Math.round((e.attended / e.registered) * 100) : 0
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="t-title">{e.title}</div>
                      <div className="muted small">{e.venue || 'TBA'}</div>
                    </td>
                    <td className="mono-cell">{timeLabel(e.starts_at)}</td>
                    <td className="num">{e.registered}</td>
                    <td className="num live-num">{e.attended}</td>
                    <td className="num muted">{rate}%</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv(e.id, e.title)}><Download /> CSV</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'students' && (
        <>
          <div className="row">
            <input className="input mono" placeholder="Search by name, roll, dept, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="admin-table">
            <table>
              <thead>
                <tr><th>Student</th><th>Roll</th><th>Dept</th><th>Year</th><th>Reg.</th><th>Attn.</th></tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No students match.</td></tr>
                )}
                {filteredStudents.map((s) => (
                  <tr key={s.email}>
                    <td>
                      <div className="t-title">{s.name || '—'}</div>
                      <div className="muted small">{s.email}</div>
                    </td>
                    <td className="mono-cell">{s.roll_no || '—'}</td>
                    <td>{s.department ? <span className={`dept-chip ${deptClass(s.department)}`}>{s.department}</span> : <span className="muted">—</span>}</td>
                    <td className="mono-cell">{s.year || '—'}</td>
                    <td className="num">{s.registrations}</td>
                    <td className="num live-num">{s.attendances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'depts' && (
        <div className="admin-table">
          <table>
            <thead><tr><th>Department</th><th>Students</th><th>Share</th></tr></thead>
            <tbody>
              {overview.byDept.map((d) => {
                const pct = overview.totalStudents ? Math.round((d.n / overview.totalStudents) * 100) : 0
                return (
                  <tr key={d.department}>
                    <td><span className={`dept-chip ${deptClass(d.department)}`}>{d.department}</span></td>
                    <td className="num">{d.n}</td>
                    <td style={{ minWidth: 240 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="progress" style={{ flex: 1 }}><span style={{ width: pct + '%' }} /></div>
                        <span className="mono small" style={{ color: 'var(--muted)' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
