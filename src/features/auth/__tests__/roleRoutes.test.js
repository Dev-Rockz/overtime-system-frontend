import { describe, expect, test } from 'vitest'
import {
  getHomePathForRole,
  getPostLoginPath,
  isSupportedAppRole,
} from '../roleRoutes.js'

describe('role routes', () => {
  test.each([
    ['user', '/employee'],
    ['supervisor', '/supervisor'],
    ['admin', '/login'],
  ])('maps %s to its available home route', (role, expectedPath) => {
    expect(getHomePathForRole(role)).toBe(expectedPath)
  })

  test('accepts only roles with an implemented frontend workspace', () => {
    expect(isSupportedAppRole('user')).toBe(true)
    expect(isSupportedAppRole('supervisor')).toBe(true)
    expect(isSupportedAppRole('admin')).toBe(false)
  })

  test('returns to a requested route only when it belongs to the signed-in role', () => {
    expect(getPostLoginPath('supervisor', {
      pathname: '/supervisor/approvals',
      search: '?status=pending',
      hash: '#latest',
    })).toBe('/supervisor/approvals?status=pending#latest')

    expect(getPostLoginPath('supervisor', {
      pathname: '/employee/plans',
      search: '',
      hash: '',
    })).toBe('/supervisor')
  })
})
