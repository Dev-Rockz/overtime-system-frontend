import { apiRequest } from './client.js'

export const actualOvertimeApi = {
  async addComment(actualEntryId, remarks) {
    const data = await apiRequest(
      `/api/overtime/actual-entries/${encodeURIComponent(actualEntryId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ remarks: remarks.trim() }),
      },
    )
    return data.comment
  },

  async getPeriod(actualPeriodId) {
    const data = await apiRequest(
      `/api/overtime/actual-periods/${encodeURIComponent(actualPeriodId)}`,
    )
    return data.actualPeriod
  },

  async getFinalDocument(actualPeriodId) {
    const blob = await apiRequest(
      `/api/overtime/actual-periods/${encodeURIComponent(actualPeriodId)}/final-document`,
      { responseType: 'blob' },
    )
    return {
      actualPeriodId,
      blob,
      fileName: `${actualPeriodId}.xlsx`,
    }
  },

  async listMyPeriods(filters = {}) {
    const searchParams = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    })

    const query = searchParams.toString()
    const data = await apiRequest(`/api/overtime/actual-periods${query ? `?${query}` : ''}`)
    return data.actualPeriods
  },

  async updateEntry(actualEntryId, update) {
    const data = await apiRequest(
      `/api/overtime/actual-entries/${encodeURIComponent(actualEntryId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(update),
      },
    )
    return data.actualEntry
  },
}
