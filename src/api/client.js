import { appConfig } from '../config/appConfig.js'
import { clearSession, getStoredSession } from '../features/auth/session.js'

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status || 0
    this.code = options.code || ''
    this.details = options.details || null
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}))
  }

  return response.text().catch(() => '')
}

export async function apiRequest(path, requestOptions = {}) {
  const {
    auth = true,
    headers: customHeaders,
    responseType = 'auto',
    ...fetchOptions
  } = requestOptions
  const headers = new Headers(customHeaders)
  const session = getStoredSession()

  if (!(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth && session?.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.token}`)
  }

  let response

  try {
    response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      ...fetchOptions,
      headers,
    })
  } catch {
    throw new ApiError(
      'Unable to reach the overtime service. Please try again shortly.',
      { code: 'NETWORK_ERROR' },
    )
  }

  const data = response.ok && responseType === 'blob'
    ? await response.blob()
    : await parseResponse(response)

  if (!response.ok) {
    if (response.status === 401 && auth && session?.token) {
      clearSession()
    }

    throw new ApiError(
      data?.message || 'The request could not be completed.',
      {
        status: response.status,
        code: data?.code,
        details: data,
      },
    )
  }

  return data
}
