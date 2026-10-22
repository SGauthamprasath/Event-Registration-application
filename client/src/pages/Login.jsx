import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState('')
  const [devEmail, setDevEmail] = useState('')

  useEffect(() => { api('/config').then(setCfg).catch(() => setError('Cannot reach the server')) }, [])

  if (user) return <Navigate to="/" replace />

  // Google gives the browser a signed ID token; the server verifies it and checks the email domain.
  async function onGoogle(resp) {
    setError('')
    try {
      const d = await api('/auth/google', { method: 'POST', body: { credential: resp.credential } })
      login(d.token, d.user)
    } catch (e) { setError(e.message) }
  }

  async function onDev(e) {
    e.preventDefault()
    setError('')
    try {
      const d = await api('/auth/dev', { method: 'POST', body: { email: devEmail } })
      login(d.token, d.user)
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="card narrow">
      <h1>Campus Events</h1>
      <p className="muted">Sign in with your college account{cfg ? ` (@${cfg.domain})` : ''} to register for events and mark attendance.</p>

      {cfg?.googleClientId && (
        <GoogleOAuthProvider clientId={cfg.googleClientId}>
          <div className="center"><GoogleLogin onSuccess={onGoogle} onError={() => setError('Google sign-in failed')} /></div>
        </GoogleOAuthProvider>
      )}
      {cfg && !cfg.googleClientId && !cfg.devLogin && <p className="error">Google sign-in is not configured on the server yet.</p>}

      {cfg?.devLogin && (
        <form onSubmit={onDev} className="stack devbox">
          <p className="muted small">Local testing login (disabled in production)</p>
          <input type="email" required placeholder={`you@${cfg.domain}`} value={devEmail} onChange={(e) => setDevEmail(e.target.value)} />
          <button>Continue</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
