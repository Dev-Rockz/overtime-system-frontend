import { ApiError, apiRequest } from './client.js'

export const employeeApi = {
  async getMyProfile() {
    const data = await apiRequest('/api/overtime/employees/me')
    return data.employee
  },

  async getMySignature() {
    try {
      const data = await apiRequest('/api/users/signature')
      return data.signature
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
}
