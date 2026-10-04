import { Navigate, Outlet } from 'react-router-dom'
import { getHomePathForRole } from '../features/auth/roleRoutes.js'
import { useAuth } from '../features/auth/useAuth.js'

export function PublicOnlyRoute() {
  const { isAuthenticated, loginRedirect, user } = useAuth()

  return isAuthenticated
    ? <Navigate replace to={loginRedirect || getHomePathForRole(user?.role)} state={loginRedirect ? { loginEntrance: true } : undefined} />
    : <Outlet />
}
