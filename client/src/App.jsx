import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Attend from './pages/Attend.jsx'
import EventForm from './pages/EventForm.jsx'
import TeacherEvent from './pages/TeacherEvent.jsx'

// Gate: must be logged in; students must also have finished their profile.
function Protected({ children, teacherOnly, allowIncomplete }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="center muted">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (teacherOnly && user.role !== 'teacher') return <Navigate to="/" replace />
  if (user.role === 'student' && !user.profileComplete && !allowIncomplete) return <Navigate to="/profile" replace />
  return children
}

function Header() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <header className="topbar">
      <Link to="/" className="brand">Campus Events</Link>
      <div className="who">
        <span>{user.name || user.email}{user.role === 'teacher' && <span className="pill">Teacher</span>}</span>
        {user.role === 'student' && <Link to="/profile">Profile</Link>}
        <button className="link" onClick={logout}>Log out</button>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Protected allowIncomplete><Profile /></Protected>} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/events/:id/attend" element={<Protected><Attend /></Protected>} />
          <Route path="/teacher/events/new" element={<Protected teacherOnly><EventForm /></Protected>} />
          <Route path="/teacher/events/:id/edit" element={<Protected teacherOnly><EventForm /></Protected>} />
          <Route path="/teacher/events/:id" element={<Protected teacherOnly><TeacherEvent /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
