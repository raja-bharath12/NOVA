import axios from 'axios'

const envBackend = (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, '')

const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')

export const BACKEND_URL =
  envBackend ||
  (isVercel
    ? ''
    : import.meta.env.PROD
    ? 'http://15.207.247.33'
    : typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost'
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : 'http://localhost:8080')


export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || (BACKEND_URL ? `${BACKEND_URL}/api` : '/api')

export const WS_BASE_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  (BACKEND_URL ? `${BACKEND_URL}/ws` : `${typeof window !== 'undefined' ? window.location.origin : ''}/ws`)



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
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/watch/') && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
