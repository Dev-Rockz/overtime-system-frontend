import { Navigate, Route, Routes } from 'react-router-dom'
import { BrandMark } from './components/shared/BrandMark.jsx'
import { LoginPage } from './features/auth/LoginPage.jsx'
import { getHomePathForRole } from './features/auth/roleRoutes.js'
import { useAuth } from './features/auth/useAuth.js'
import { employeeRoutes } from './routes/employeeRoutes.jsx'
import { PublicOnlyRoute } from './routes/PublicOnlyRoute.jsx'
import { supervisorRoutes } from './routes/supervisorRoutes.jsx'

function SessionLoading() {
  return (
    <main className="session-loading" aria-live="polite">
      <BrandMark />
      <span>Restoring your session...</span>
    </main>
  )
}

function App() {
  const { isRestoring, user } = useAuth()
  const homePath = user ? getHomePathForRole(user.role) : '/login'

  if (isRestoring) {
    return <SessionLoading />
  }

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {employeeRoutes}
      {supervisorRoutes}

      <Route
        path="/"
        element={<Navigate replace to={homePath} />}
      />
      <Route
        path="*"
        element={<Navigate replace to={homePath} />}
      />
    </Routes>
  )
}

export default App
