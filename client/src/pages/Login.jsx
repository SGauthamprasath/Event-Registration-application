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

  async function onSend(e) {
    e?.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      await api('/auth/otp/request', { method: 'POST', body: { email } })
      setSent(true)
      setInfo(`We mailed a code to ${email}. Check your inbox and spam.`)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

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
    <div className="auth-card">
      <div className="card card-pad-lg stack">
        <div className="brand brand-lg">
          <span className="brand-bar" aria-hidden />
          <div className="brand-mark">
            <div className="bm-name">campus<span className="bm-dot">.</span>events</div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 10 }}>// ACCESS CONTROL</div>
          <h1 style={{ marginBottom: 10 }}>Check in to Campus Events.</h1>
          <p className="muted small">Sign in with your college email{cfg ? ` (@${cfg.domain})` : ''}. We'll mail a one-time code.</p>
        </div>

        {!sent ? (
          <form onSubmit={onSend} className="stack" style={{ marginTop: 8 }}>
            <div className="field">
              <span className="label">College email</span>
              <input className="input mono" type="email" required autoComplete="email"
                placeholder={`you@${cfg?.domain || 'college.edu'}`}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Send code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="stack" style={{ marginTop: 8 }}>
            <div className="field">
              <span className="label">Verification code</span>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code"
                pattern="\d{6}" maxLength={6} required autoFocus
                placeholder="6-digit code"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: '0.4em', fontSize: 20, textAlign: 'center' }} />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify and sign in →'}
            </button>
            <div className="row between small">
              <button type="button" className="btn-link" onClick={() => onSend()}>Resend code</button>
              <button type="button" className="btn-link" onClick={() => { setSent(false); setCode(''); setInfo(''); setError('') }}>Use another email</button>
            </div>
          </form>
        )}
        {info && <p className="muted small">{info}</p>}
        {error && <p className="err-text">{error}</p>}

        {cfg?.devLogin && (
          <form onSubmit={onDev} className="stack devbox">
            <div className="tag" style={{ color: 'var(--warn)' }}>[DEV LOGIN ON] bypass for local testing</div>
            <div className="field">
              <span className="label">Dev email</span>
              <input className="input mono" type="email" required placeholder={`you@${cfg.domain}`} value={devEmail} onChange={(e) => setDevEmail(e.target.value)} />
            </div>
            <button className="btn btn-ghost btn-block">Continue →</button>
          </form>
        )}
      </div>
    </div>
  )
}
