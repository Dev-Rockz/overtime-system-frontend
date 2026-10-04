export const SESSION_KEY = 'overtime-system.session'

const LEGACY_SESSION_KEYS = ['overtime-system.employee-session']

export const SESSION_CLEARED_EVENT = 'overtime-system:session-cleared'

function isValidSession(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.token === 'string'
    && value.token
    && value.user
    && typeof value.user === 'object',
  )
}

export function getStoredSession() {
  const storageKeys = [SESSION_KEY, ...LEGACY_SESSION_KEYS]

  for (const storageKey of storageKeys) {
    try {
      const value = window.localStorage.getItem(storageKey)
      if (!value) continue

      const session = JSON.parse(value)
      if (!isValidSession(session)) {
        window.localStorage.removeItem(storageKey)
        continue
      }

      if (storageKey !== SESSION_KEY) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        window.localStorage.removeItem(storageKey)
      }

      return session
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }

  return null
}

export function storeSession(session) {
  if (!isValidSession(session)) {
    throw new Error('Cannot store an invalid authentication session.')
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: session.token,
    user: session.user,
  }))
  LEGACY_SESSION_KEYS.forEach((storageKey) => window.localStorage.removeItem(storageKey))
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY)
  LEGACY_SESSION_KEYS.forEach((storageKey) => window.localStorage.removeItem(storageKey))
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))
}
