import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [devEmail, setDevEmail] = useState('')

  useEffect(() => { api('/config').then(setCfg).catch(() => setError('Cannot reach the server')) }, [])

  if (user) return <Navigate to="/" replace />

  // Step 1: the server checks the domain and mails a 6-digit code.
  async function onSend(e) {
    e?.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      await api('/auth/otp/request', { method: 'POST', body: { email } })
      setSent(true)
      setInfo(`We sent a code to ${email}. Check your inbox (and spam).`)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  // Step 2: the server checks the code and returns a session.
  async function onVerify(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const d = await api('/auth/otp/verify', { method: 'POST', body: { email, code } })
      login(d.token, d.user)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
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
      <p className="muted">Sign in with your college email{cfg ? ` (@${cfg.domain})` : ''} to register for events and mark attendance.</p>

      {!sent ? (
        <form onSubmit={onSend} className="stack">
          <input type="email" required autoComplete="email" placeholder={`you@${cfg?.domain || 'college.edu'}`}
                 value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={busy}>{busy ? 'Sending...' : 'Send login code'}</button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="stack">
          <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
                 placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button disabled={busy}>{busy ? 'Checking...' : 'Verify and sign in'}</button>
          <p className="small muted">
            <a href="#" onClick={(e) => { e.preventDefault(); onSend() }}>Resend code</a>
            {' · '}
            <a href="#" onClick={(e) => { e.preventDefault(); setSent(false); setCode(''); setInfo(''); setError('') }}>Use a different email</a>
          </p>
        </form>
      )}
      {info && <p className="muted small">{info}</p>}

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
