import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getHomePathForRole } from '../features/auth/roleRoutes.js'
import { useAuth } from '../features/auth/useAuth.js'
import { WorkspaceEntrance } from '../features/auth/WorkspaceEntrance.jsx'

export function ProtectedRoute({ allowedRoles }) {
  const { clearLoginRedirect, isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate replace to={getHomePathForRole(user.role)} />
  }

  return <WorkspaceEntrance onEntered={clearLoginRedirect}><Outlet /></WorkspaceEntrance>
}
