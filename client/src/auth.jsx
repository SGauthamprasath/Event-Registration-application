import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import { supabase } from './supabase.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Only a 401 means "not logged in". If the server is waking up (Render) or busy, keep the
  // session and retry, rather than showing the login page and prompting a new email code.
  const loadMe = useCallback(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const { user } = await api('/me')
        setUser(user)
        break
      } catch (e) {
        if (e.status === 401 || attempt >= 10) { setUser(null); break }
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)))
      }
    }
    setLoading(false)
  }, [])

  // Hydrate the user on mount from any existing Supabase session, and keep in sync.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (session) await loadMe()
      else { setUser(null); setLoading(false) }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); return }
      if (session) loadMe()
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [loadMe])

  // The server pushes a ce-logout event on 401; mirror that in state.
  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('ce-logout', onLogout)
    return () => window.removeEventListener('ce-logout', onLogout)
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    setUser(null)
  }, [])

  // Backwards-compatible shim: Login.jsx no longer calls this (Supabase handles auth
  // state), but if anything else does, just re-fetch the profile.
  const login = useCallback(() => loadMe(), [loadMe])

  return <AuthCtx.Provider value={{ user, setUser, loading, login, logout }}>{children}</AuthCtx.Provider>
}
