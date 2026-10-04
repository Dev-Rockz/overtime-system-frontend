import { apiRequest } from './client.js'

export const supervisorApi = {
  async assignBulkEmployeePlans(plan) {
    const data = await apiRequest('/api/overtime/plans/employees/bulk-assign', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
    return data.overtimePlans || []
  },

  async withdrawBulkEmployeePlans(selection) {
    const data = await apiRequest('/api/overtime/plans/employees/bulk-withdraw', {
      method: 'POST',
      body: JSON.stringify(selection),
    })
    return data.result
  },

  async acceptEmployeePlan(planId, remarks = '') {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/supervisor-accept`,
      {
        method: 'PATCH',
        body: JSON.stringify({ remarks: remarks.trim() || undefined }),
      },
    )
    return data.overtimePlan
  },

  async createDepartmentPlan(plan) {
    const data = await apiRequest('/api/overtime/plans/department/from-drafts', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
    return data.overtimePlan
  },

  async createBulkDepartmentPlan(plan) {
    const data = await apiRequest('/api/overtime/plans/department/bulk-draft', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
    return data.overtimePlan
  },

  async deleteDepartmentDraft(planId) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}`,
      { method: 'DELETE' },
    )
    return data.overtimePlan
  },

  async getDepartmentPlan(planId) {
    const data = await apiRequest(`/api/overtime/plans/${encodeURIComponent(planId)}`)
    return data.overtimePlan
  },

  async getDepartmentApprovalDetails(planId) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/approval-details`,
    )
    return data.overtimePlan
  },

  async getDepartmentPreparation(filters) {
    const searchParams = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })
    const data = await apiRequest(
      `/api/overtime/plans/supervisor-dashboard?${searchParams.toString()}`,
    )
    return data.supervisorDashboard
  },

  async getTeamMember(employeeId) {
    const data = await apiRequest(
      `/api/overtime/employees/${encodeURIComponent(employeeId)}`,
    )
    return data.employee
  },

  async listMyTeam() {
    const data = await apiRequest('/api/overtime/employees')
    return data.employees || []
  },

  async listDepartmentDrafts(filters) {
    const searchParams = new URLSearchParams({
      planScope: 'department',
      status: 'draft,returned_for_revision',
      limit: '100',
    })
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })
    const data = await apiRequest(`/api/overtime/plans?${searchParams.toString()}`)
    const plans = data.overtimePlans || []
    return Promise.all(plans.map((plan) => supervisorApi.getDepartmentPlan(plan.planId)))
  },

  async listDepartmentApprovalPlans(filters = {}) {
    const searchParams = new URLSearchParams({
      planScope: 'department',
      status: 'pending_approval,returned_for_revision,approved,closed',
      limit: '100',
    })
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })
    const data = await apiRequest(`/api/overtime/plans?${searchParams.toString()}`)
    return data.overtimePlans || []
  },

  async returnEmployeePlan(planId, remarks) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/supervisor-return`,
      {
        method: 'PATCH',
        body: JSON.stringify({ remarks: remarks.trim() }),
      },
    )
    return data.overtimePlan
  },

  async replaceBulkDepartmentPlan(planId, plan) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/department/bulk-draft`,
      {
        method: 'PUT',
        body: JSON.stringify(plan),
      },
    )
    return data.overtimePlan
  },

  async submitDepartmentPlan(planId, remarks = '') {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/department-submit-and-sign`,
      {
        method: 'PATCH',
        body: JSON.stringify({ remarks: remarks.trim() || undefined }),
      },
    )
    return data.overtimePlan
  },
}
