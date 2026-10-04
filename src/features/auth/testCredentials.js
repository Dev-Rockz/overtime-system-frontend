const TEST_CREDENTIALS_KEY = 'overtime-system.test-credentials'

export function getStoredTestCredentials() {
  try {
    const value = window.localStorage.getItem(TEST_CREDENTIALS_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function storeTestCredentials(credentials) {
  window.localStorage.setItem(TEST_CREDENTIALS_KEY, JSON.stringify(credentials))
}

export function clearTestCredentials() {
  window.localStorage.removeItem(TEST_CREDENTIALS_KEY)
}
