import { lazy, Suspense } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'
import Dashboard from './pages/Dashboard.jsx'
import EventDetail from './pages/EventDetail.jsx'
import { useEvents } from './useEvents.js'

// Loaded on demand: the QR scanner library is most of the bundle and only the scan page needs
// it, and students never open the teacher pages.
const Attend = lazy(() => import('./pages/Attend.jsx'))
const EventForm = lazy(() => import('./pages/EventForm.jsx'))
const TeacherEvent = lazy(() => import('./pages/TeacherEvent.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

function Brand() {
  return (
    <>
      <span className="brand-bar" aria-hidden />
      <div className="brand-mark">
        <div className="bm-name">campus<span className="bm-dot">.</span>events</div>
      </div>
    </>
  )
}

function Protected({ children, teacherOnly, allowIncomplete }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="loading">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (teacherOnly && user.role !== 'teacher') return <Navigate to="/" replace />
  if (user.role === 'student' && !user.profileComplete && !allowIncomplete) return <Navigate to="/profile" replace />
  return children
}

function initials(user) {
  const src = user?.name || user?.email || '?'
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

function LiveBadge() {
  const { events } = useEvents()
  const n = events.filter((e) => e.status === 'live').length
  if (!n) return null
  return <span className="live-pill"><i className="dot pulse" />Live · {n}</span>
}

function TopBar() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  if (!user) return null
  const isTeacher = user.role === 'teacher'
  const hideShell = loc.pathname === '/profile' && !user.profileComplete

  if (hideShell) {
    return (
      <header className="topbar">
        <Link to="/profile" className="brand"><Brand /></Link>
        <div className="spacer" />
        <button className="logout" onClick={logout}>Log out</button>
      </header>
    )
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand"><Brand /></Link>

      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Events</NavLink>
        <NavLink to="/my" className={({ isActive }) => isActive ? 'active' : ''}>My Registrations</NavLink>
        {isTeacher && <NavLink to="/teacher/console" className={({ isActive }) => isActive ? 'active' : ''}>Control Room</NavLink>}
        {isTeacher && <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>}
      </nav>

      <div className="spacer" />
      <LiveBadge />

      <Link to="/profile" className="avatar" title={user.name || user.email}>{initials(user)}</Link>
      <button className="logout" onClick={logout}>Log out</button>
    </header>
  )
}

function Footer() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <footer className="footer">
      <div>Campus Events · PSG Institute of Technology &amp; Applied Research</div>
      <div>&copy; {new Date().getFullYear()} Department of AI &amp; Data Science</div>
    </footer>
  )
}

function TeacherConsoleHome() {
  const { events } = useEvents()
  const live = events.find((e) => e.status === 'live')
  if (live) return <Navigate to={`/teacher/events/${live.id}`} replace />
  const next = events.find((e) => e.status === 'upcoming') || events[0]
  if (next) return <Navigate to={`/teacher/events/${next.id}`} replace />
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <>
      <TopBar />
      <main className="page">
        <Suspense fallback={<p className="loading">Loading…</p>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Protected allowIncomplete><Profile /></Protected>} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/my" element={<Protected><Dashboard filter="mine" /></Protected>} />
          <Route path="/admin" element={<Protected teacherOnly><Admin /></Protected>} />
          <Route path="/events/:id" element={<Protected><EventDetail /></Protected>} />
          <Route path="/events/:id/attend" element={<Protected><Attend /></Protected>} />
          <Route path="/teacher/console" element={<Protected teacherOnly><TeacherConsoleHome /></Protected>} />
          <Route path="/teacher/events/new" element={<Protected teacherOnly><EventForm /></Protected>} />
          <Route path="/teacher/events/:id/edit" element={<Protected teacherOnly><EventForm /></Protected>} />
          <Route path="/teacher/events/:id" element={<Protected teacherOnly><TeacherEvent /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
