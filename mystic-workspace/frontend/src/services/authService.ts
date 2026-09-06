import api from './api'
import type { User } from '../types'

interface AuthResponse {
  token: string
  userId: number
  name: string
  email: string
  userTag?: string
}

const TAG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateFallbackTag(id?: number, email?: string): string {
  const seed = `${id || 1}_${email || 'bharath'}_nova_workspace`
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  let current = Math.abs(hash)
  let tag = ''
  for (let i = 0; i < 10; i++) {
    tag += TAG_CHARS[(current + i * 13 + i * i * 7) % TAG_CHARS.length]
    current = Math.floor((current * 1664525 + 1013904223) % 2147483647)
  }
  return tag
}

export function ensureUserTag(user: User | null): User | null {
  if (!user) return null
  if (!user.userTag || user.userTag.trim() === '' || user.userTag.includes('DEMO')) {
    user.userTag = generateFallbackTag(user.id, user.email)
    localStorage.setItem('mystic_user', JSON.stringify(user))
  }
  return user
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
  try {
    const { data } = await api.get<User>('/users/me')
    const current: Partial<User> = getStoredUser() || {}
    const merged: User = {
      id: data.id || current.id || 1,
      name: data.name || current.name || '',
      email: data.email || current.email || '',
      userTag: data.userTag || current.userTag || generateFallbackTag(data.id || current.id, data.email || current.email)
    }
    localStorage.setItem('mystic_user', JSON.stringify(merged))
    return merged
  } catch {
    const current = getStoredUser()
    if (current) {
      return ensureUserTag(current)!
    }
    throw new Error('User not found')
  }
}

function persist(data: AuthResponse): User {
  const user: User = {
    id: data.userId,
    name: data.name,
    email: data.email,
    userTag: data.userTag || generateFallbackTag(data.userId, data.email),
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
  if (!raw) return null
  try {
    const user: User = JSON.parse(raw)
    return ensureUserTag(user)
  } catch {
    return null
  }
}

