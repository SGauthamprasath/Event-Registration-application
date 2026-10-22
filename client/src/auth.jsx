import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken()) // only wait if we have a token to check

  // On page load, ask the server who the saved token belongs to.
  useEffect(() => {
    if (!getToken()) return
    api('/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('ce-logout', onLogout)
    return () => window.removeEventListener('ce-logout', onLogout)
  }, [])

  const login = useCallback((token, u) => { setToken(token); setUser(u) }, [])
  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  return <AuthCtx.Provider value={{ user, setUser, loading, login, logout }}>{children}</AuthCtx.Provider>
}
