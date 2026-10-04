export const SUPPORTED_APP_ROLES = ['user', 'supervisor']

const roleHomePaths = {
  supervisor: '/supervisor',
  user: '/employee',
}

export function getHomePathForRole(role) {
  return roleHomePaths[role] || '/login'
}

export function isSupportedAppRole(role) {
  return SUPPORTED_APP_ROLES.includes(role)
}

export function getPostLoginPath(role, requestedLocation) {
  const homePath = getHomePathForRole(role)
  const requestedPath = requestedLocation?.pathname

  if (
    homePath !== '/login'
    && typeof requestedPath === 'string'
    && (requestedPath === homePath || requestedPath.startsWith(`${homePath}/`))
  ) {
    return `${requestedPath}${requestedLocation.search || ''}${requestedLocation.hash || ''}`
  }

  return homePath
}
