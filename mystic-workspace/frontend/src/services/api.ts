import axios from 'axios'

export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:8080')

export const API_BASE_URL = import.meta.env.VITE_API_URL || `${BACKEND_URL}/api`
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || `${BACKEND_URL}/ws`

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mystic_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mystic_token')
      localStorage.removeItem('mystic_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
