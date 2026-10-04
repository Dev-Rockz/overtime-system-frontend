import { Navigate, Route } from 'react-router-dom'
import { SupervisorLayout } from '../features/supervisor/SupervisorLayout.jsx'
import { SupervisorHomePage } from '../features/supervisor/pages/SupervisorHomePage.jsx'
import { SupervisorApprovedDepartmentPlansPage } from '../features/supervisor/pages/SupervisorApprovedDepartmentPlansPage.jsx'
import { SupervisorActualOvertimePage } from '../features/supervisor/pages/SupervisorActualOvertimePage.jsx'
import { SupervisorApprovalsPage } from '../features/supervisor/pages/SupervisorApprovalsPage.jsx'
import { SupervisorAssignOvertimePage } from '../features/supervisor/pages/SupervisorAssignOvertimePage.jsx'
import { SupervisorDepartmentPlanDetailPage } from '../features/supervisor/pages/SupervisorDepartmentPlanDetailPage.jsx'
import { SupervisorDepartmentDraftsPage } from '../features/supervisor/pages/SupervisorDepartmentDraftsPage.jsx'
import { SupervisorDepartmentPlansPage } from '../features/supervisor/pages/SupervisorDepartmentPlansPage.jsx'
import { SupervisorProfilePage } from '../features/supervisor/pages/SupervisorProfilePage.jsx'
import { SupervisorSectionPage } from '../features/supervisor/pages/SupervisorSectionPage.jsx'
import { SupervisorTeamPage } from '../features/supervisor/pages/SupervisorTeamPage.jsx'
import { SupervisorTeamMemberPage } from '../features/supervisor/pages/SupervisorTeamMemberPage.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'

export const supervisorRoutes = (
  <Route element={<ProtectedRoute allowedRoles={['supervisor']} />}>
    <Route path="/supervisor" element={<SupervisorLayout />}>
      <Route index element={<SupervisorHomePage />} />
      <Route
        path="employee-plans"
        element={<Navigate replace to="/supervisor/overtime-department-plans" />}
      />
      <Route
        path="employee-plans/:planId"
        element={<Navigate replace to="/supervisor/overtime-department-plans" />}
      />
      <Route
        path="department-plans"
        element={<SupervisorDepartmentPlansPage />}
      />
      <Route
        path="assign-overtime"
        element={<SupervisorAssignOvertimePage />}
      />
      <Route
        path="department-drafts"
        element={<SupervisorDepartmentDraftsPage />}
      />
      <Route
        path="department-plans/:planId"
        element={<SupervisorDepartmentPlanDetailPage />}
      />
      <Route
        path="approvals"
        element={<SupervisorApprovalsPage />}
      />
      <Route
        path="overtime-department-plans"
        element={<SupervisorApprovedDepartmentPlansPage />}
      />
      <Route
        path="actual-overtime"
        element={<SupervisorActualOvertimePage />}
      />
      <Route path="team" element={<SupervisorTeamPage />} />
      <Route path="team/:employeeId" element={<SupervisorTeamMemberPage />} />
      <Route
        path="notifications"
        element={(
          <SupervisorSectionPage
            description="Overtime activity and workflow updates"
            title="Notifications"
          />
        )}
      />
      <Route path="profile" element={<SupervisorProfilePage />} />
    </Route>
  </Route>
)
