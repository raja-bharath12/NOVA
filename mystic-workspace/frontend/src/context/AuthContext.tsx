import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../types'
import * as authService from '../services/authService'
import websocketService from '../services/websocketService'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, username?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = authService.getStoredUser()
    setUser(stored)
    setLoading(false)

    const token = localStorage.getItem('mystic_token')
    if (token) {
      websocketService.connect(token)
      authService.fetchCurrentUserProfile()
        .then((fresh) => {
          if (fresh) setUser(fresh)
        })
        .catch(() => {})
    }
  }, [])

  async function login(identifier: string, password: string) {
    const u = await authService.login(identifier, password)
    setUser(u)
    const token = localStorage.getItem('mystic_token')
    if (token) {
      websocketService.connect(token)
    }
  }

  async function register(name: string, email: string, password: string, username?: string) {
    const u = await authService.register(name, email, password, username)
    setUser(u)
    const token = localStorage.getItem('mystic_token')
    if (token) {
      websocketService.connect(token)
    }
  }

  function logout() {
    websocketService.disconnect()
    authService.logout()
    setUser(null)
  }


  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
