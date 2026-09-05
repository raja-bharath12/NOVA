import axios from 'axios'

const isProd = import.meta.env.PROD

export const BACKEND_URL = 'http://65.2.121.136'
export const API_BASE_URL = 'http://65.2.121.136/api'

export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  (BACKEND_URL
    ? `${BACKEND_URL}/ws`
    : `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:'}//${typeof window !== 'undefined' ? window.location.host : 'localhost:8080'}/ws`)

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
