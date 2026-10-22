import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { supabase } from '../supabase.js'

export default function Login() {
  const { user } = useAuth()
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Only used for the domain hint — safe to call unauthenticated.
  useEffect(() => {
    const base = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
    fetch(base + '/api/config').then((r) => r.json()).then(setCfg).catch(() => setError('Cannot reach the server'))
  }, [])

  if (user) return <Navigate to="/" replace />

  const domain = cfg?.domain || 'psgitech.ac.in'

  async function onSend(e) {
    e?.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      const norm = email.trim().toLowerCase()
      if (!norm.endsWith('@' + domain)) throw new Error(`Use your @${domain} email`)
      const { error } = await supabase.auth.signInWithOtp({
        email: norm,
        // The email carries both a code (6–8 digits, set in Supabase → Auth) and a link; the link returns here.
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) throw error
      setEmail(norm)
      setSent(true)
      setInfo(`We mailed a code to ${norm}. Type it here, or open the link in the email on this device. Check spam too.`)
    } catch (err) {
      setError(err.message || 'Could not send code.')
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email',
      })
      if (error) throw error
      // AuthProvider.onAuthStateChange picks up the new session and loads /api/me.
    } catch (err) {
      setError(err.message || 'Wrong or expired code.')
    } finally {
      setBusy(false)
    }
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
          <p className="muted small">Sign in with your college email (@{domain}). We'll mail a one-time code.</p>
        </div>

        {!sent ? (
          <form onSubmit={onSend} className="stack" style={{ marginTop: 8 }}>
            <div className="field">
              <span className="label">College email</span>
              <input className="input mono" type="email" required autoComplete="email"
                placeholder={`you@${domain}`}
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
                pattern="\d{6,8}" maxLength={8} required autoFocus
                placeholder="Code from the email"
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
      </div>
    </div>
  )
}
