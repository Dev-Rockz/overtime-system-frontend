export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  rememberTestCredentials:
    import.meta.env.VITE_REMEMBER_TEST_CREDENTIALS === undefined
      ? import.meta.env.DEV
      : import.meta.env.VITE_REMEMBER_TEST_CREDENTIALS === 'true',
}
