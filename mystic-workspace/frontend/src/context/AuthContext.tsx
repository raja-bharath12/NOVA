import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../types'
import * as authService from '../services/authService'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(authService.getStoredUser())
    setLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const u = await authService.login(email, password)
    setUser(u)
  }

  async function register(name: string, email: string, password: string) {
    const u = await authService.register(name, email, password)
    setUser(u)
  }

  function logout() {
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
