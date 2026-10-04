import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearSession,
  getStoredSession,
  SESSION_KEY,
  SESSION_CLEARED_EVENT,
  storeSession,
} from '../session.js'

const validSession = {
  token: 'test-token',
  user: {
    id: 'user-1',
    name: 'Test Employee',
    role: 'user',
  },
}

describe('application session storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('stores and restores a valid session', () => {
    storeSession(validSession)

    expect(getStoredSession()).toEqual(validSession)
  })

  test('ignores malformed stored session data', () => {
    window.localStorage.setItem(SESSION_KEY, '{broken')

    expect(getStoredSession()).toBeNull()
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  test('migrates a valid employee session from the legacy storage key', () => {
    window.localStorage.setItem(
      'overtime-system.employee-session',
      JSON.stringify(validSession),
    )

    expect(getStoredSession()).toEqual(validSession)
    expect(JSON.parse(window.localStorage.getItem(SESSION_KEY))).toEqual(validSession)
    expect(window.localStorage.getItem('overtime-system.employee-session')).toBeNull()
  })

  test('clears storage and announces session removal', () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_CLEARED_EVENT, listener)
    storeSession(validSession)

    clearSession()

    expect(getStoredSession()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(SESSION_CLEARED_EVENT, listener)
  })
})
