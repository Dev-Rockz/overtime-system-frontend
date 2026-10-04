import { useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../../api/authApi.js'
import { AuthContext } from './AuthContext.js'
import {
  clearSession,
  getStoredSession,
  SESSION_CLEARED_EVENT,
  storeSession,
} from './session.js'
import { getHomePathForRole, isSupportedAppRole } from './roleRoutes.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getStoredSession())
  const [isRestoring, setIsRestoring] = useState(Boolean(session?.token))
  const [loginRedirect, setLoginRedirect] = useState(null)

  useEffect(() => {
    function handleSessionCleared() {
      setSession(null)
      setIsRestoring(false)
      setLoginRedirect(null)
    }

    window.addEventListener(SESSION_CLEARED_EVENT, handleSessionCleared)
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, handleSessionCleared)
  }, [])

  useEffect(() => {
    if (!session?.token) {
      setIsRestoring(false)
      return undefined
    }

    let isActive = true

    authApi.me()
      .then(({ user }) => {
        if (!isActive) return

        if (!isSupportedAppRole(user.role)) {
          clearSession()
          return
        }

        const restoredSession = { token: session.token, user }
        storeSession(restoredSession)
        setSession(restoredSession)
      })
      .catch(() => {
        if (isActive) clearSession()
      })
      .finally(() => {
        if (isActive) setIsRestoring(false)
      })

    return () => {
      isActive = false
    }
  }, [session?.token])

  const login = useCallback((nextSession, options = {}) => {
    storeSession(nextSession)
    setLoginRedirect(options.redirectTo || getHomePathForRole(nextSession.user.role))
    setSession(nextSession)
  }, [])

  const clearLoginRedirect = useCallback(() => setLoginRedirect(null), [])

  const logout = useCallback(() => {
    clearSession()
  }, [])

  const value = useMemo(() => ({
    isAuthenticated: Boolean(session?.token && session?.user),
    isRestoring,
    login,
    loginRedirect,
    clearLoginRedirect,
    logout,
    token: session?.token || null,
    user: session?.user || null,
  }), [clearLoginRedirect, isRestoring, login, loginRedirect, logout, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
