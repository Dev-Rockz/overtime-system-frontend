import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiRequest, ApiError } from '../client.js'
import { getStoredSession, storeSession } from '../../features/auth/session.js'

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn(),
  }
}

const validSession = {
  token: 'employee-token',
  user: { id: 'user-1', role: 'user' },
}

describe('API client', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  test('automatically adds the stored bearer token', async () => {
    storeSession(validSession)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/example')

    const requestOptions = fetchMock.mock.calls[0][1]
    expect(requestOptions.headers.get('Authorization')).toBe('Bearer employee-token')
  })

  test('preserves backend status and error code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, {
      message: 'A signature is required.',
      code: 'SIGNATURE_REQUIRED',
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/example')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'SIGNATURE_REQUIRED',
      message: 'A signature is required.',
    })
  })

  test('clears an existing session after an authenticated 401 response', async () => {
    storeSession(validSession)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {
      message: 'Invalid or expired authentication token.',
    })))

    await expect(apiRequest('/api/example')).rejects.toBeInstanceOf(ApiError)
    expect(getStoredSession()).toBeNull()
  })

  test('returns a binary response as a blob when requested', async () => {
    const workbookBlob = new Blob(['PK-test-workbook'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': workbookBlob.type }),
      blob: vi.fn().mockResolvedValue(workbookBlob),
    }))

    const response = await apiRequest('/api/overtime/actual-document', {
      responseType: 'blob',
    })

    expect(response).toBe(workbookBlob)
  })
})
