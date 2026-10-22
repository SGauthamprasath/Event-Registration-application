import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import { supabase } from './supabase.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    try {
      const { user } = await api('/me')
      setUser(user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
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
