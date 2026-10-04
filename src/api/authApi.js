import { apiRequest } from './client.js'

export const authApi = {
  login(credentials) {
    return apiRequest('/api/auth/login', {
      auth: false,
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  me() {
    return apiRequest('/api/auth/me')
  },
}
