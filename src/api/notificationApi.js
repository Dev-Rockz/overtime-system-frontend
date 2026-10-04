import { apiRequest } from './client.js'

export const notificationApi = {
  async list(options = {}) {
    const searchParams = new URLSearchParams()

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })

    const query = searchParams.toString()
    return apiRequest(`/api/notifications${query ? `?${query}` : ''}`)
  },

  async markRead(notificationId) {
    const data = await apiRequest(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'PATCH' },
    )
    return data.notification
  },

  async markAllRead() {
    return apiRequest('/api/notifications/read-all', { method: 'PATCH' })
  },

  async markActualPeriodRead(actualPeriodId) {
    return apiRequest(
      `/api/notifications/actual-periods/${encodeURIComponent(actualPeriodId)}/read`,
      { method: 'PATCH' },
    )
  },

  async markPlanRead(planId) {
    return apiRequest(
      `/api/notifications/plans/${encodeURIComponent(planId)}/read`,
      { method: 'PATCH' },
    )
  },
}
