import api from './api'
import type { User } from '../types'

interface AuthResponse {
  token: string
  userId: number
  name: string
  email: string
  userTag?: string
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
  return persist(data)
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password })
  return persist(data)
}

export async function fetchCurrentUserProfile(): Promise<User> {
  const { data } = await api.get<User>('/users/me')
  const current = getStoredUser() || {}
  const merged: User = { ...current, ...data }
  localStorage.setItem('mystic_user', JSON.stringify(merged))
  return merged
}

function persist(data: AuthResponse): User {
  const user: User = {
    id: data.userId,
    name: data.name,
    email: data.email,
    userTag: data.userTag,
  }
  localStorage.setItem('mystic_token', data.token)
  localStorage.setItem('mystic_user', JSON.stringify(user))
  return user
}

export function logout() {
  localStorage.removeItem('mystic_token')
  localStorage.removeItem('mystic_user')
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem('mystic_user')
  return raw ? JSON.parse(raw) : null
}
