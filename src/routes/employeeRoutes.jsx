import { Route } from 'react-router-dom'
import { EmployeeLayout } from '../features/employee/EmployeeLayout.jsx'
import { ActualOvertimePage } from '../features/employee/pages/ActualOvertimePage.jsx'
import { EmployeeHomePage } from '../features/employee/pages/EmployeeHomePage.jsx'
import { EmployeeNotificationsPage } from '../features/employee/pages/EmployeeNotificationsPage.jsx'
import { EmployeePlanDetailPage } from '../features/employee/pages/EmployeePlanDetailPage.jsx'
import { EmployeePlanEditorPage } from '../features/employee/pages/EmployeePlanEditorPage.jsx'
import { EmployeePlansPage } from '../features/employee/pages/EmployeePlansPage.jsx'
import { EmployeeProfilePage } from '../features/employee/pages/EmployeeProfilePage.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'

export const employeeRoutes = (
  <Route element={<ProtectedRoute allowedRoles={['user']} />}>
    <Route path="/employee" element={<EmployeeLayout />}>
      <Route index element={<EmployeeHomePage />} />
      <Route path="plans" element={<EmployeePlansPage />} />
      <Route path="plans/new" element={<EmployeePlanEditorPage />} />
      <Route path="plans/:planId/edit" element={<EmployeePlanEditorPage />} />
      <Route path="plans/:planId" element={<EmployeePlanDetailPage />} />
      <Route path="actual-overtime" element={<ActualOvertimePage />} />
      <Route path="notifications" element={<EmployeeNotificationsPage />} />
      <Route path="profile" element={<EmployeeProfilePage />} />
    </Route>
  </Route>
)
