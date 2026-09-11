import axios from 'axios'

const envBackend = (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, '')

export const BACKEND_URL =
  envBackend ||
  (import.meta.env.PROD
    ? 'https://mystic-nova.duckdns.org'
    : typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost'
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : 'http://localhost:8080')

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || `${BACKEND_URL}/api`

export const WS_BASE_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) || `${BACKEND_URL}/ws`

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
