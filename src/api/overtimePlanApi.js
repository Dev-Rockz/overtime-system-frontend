import { apiRequest } from './client.js'

export const overtimePlanApi = {
  async addItems(planId, items) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/items/bulk`,
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    )
    return data
  },

  async createPlan(plan) {
    const data = await apiRequest('/api/overtime/plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
    return data.overtimePlan
  },

  async createDraft(draft) {
    const data = await apiRequest('/api/overtime/plans/draft', {
      method: 'POST',
      body: JSON.stringify(draft),
    })
    return data.overtimePlan
  },

  async deleteItem(planId, itemId) {
    return apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' },
    )
  },

  async deletePlan(planId) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}`,
      { method: 'DELETE' },
    )
    return data.overtimePlan
  },

  async getCalendar(filters = {}) {
    const searchParams = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })

    const query = searchParams.toString()
    const data = await apiRequest(`/api/overtime/plans/calendar${query ? `?${query}` : ''}`)
    return data.calendar
  },

  async getPlan(planId) {
    const data = await apiRequest(`/api/overtime/plans/${encodeURIComponent(planId)}`)
    return data.overtimePlan
  },

  async listMyPlans(filters = {}) {
    const searchParams = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })

    const query = searchParams.toString()
    const data = await apiRequest(`/api/overtime/plans${query ? `?${query}` : ''}`)
    return data.overtimePlans
  },

  async listMyPlanItems(filters = {}) {
    const searchParams = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })

    const query = searchParams.toString()
    const data = await apiRequest(`/api/overtime/plans/items${query ? `?${query}` : ''}`)
    return data.overtimePlanItems
  },

  async submitAndSignPlan(planId, remarks) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/submit-and-sign`,
      {
        method: 'PATCH',
        body: JSON.stringify({ remarks: remarks?.trim() || undefined }),
      },
    )
    return data.plan
  },

  async replaceDraft(planId, draft) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/draft`,
      {
        method: 'PUT',
        body: JSON.stringify(draft),
      },
    )
    return data.overtimePlan
  },

  async updateItem(planId, itemId, updates) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    )
    return data.item
  },

  async updatePlan(planId, updates) {
    const data = await apiRequest(`/api/overtime/plans/${encodeURIComponent(planId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    return data.overtimePlan
  },

  async withdrawPlan(planId, remarks) {
    const data = await apiRequest(
      `/api/overtime/plans/${encodeURIComponent(planId)}/withdraw`,
      {
        method: 'PATCH',
        body: JSON.stringify({ remarks: remarks.trim() }),
      },
    )
    return data.plan
  },
}
