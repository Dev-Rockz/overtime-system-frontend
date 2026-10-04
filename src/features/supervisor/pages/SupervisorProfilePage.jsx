import { EmployeeProfilePage } from '../../employee/pages/EmployeeProfilePage.jsx'

export function SupervisorProfilePage() {
  return (
    <EmployeeProfilePage
      mainClassName="supervisor-main"
      portalLabel="Supervisor portal"
      queryScope="supervisor"
    />
  )
}
