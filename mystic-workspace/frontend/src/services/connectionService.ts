import api from './api'
import type { User, UserConnection } from '../types'

export const connectionService = {
  async searchUsers(query?: string): Promise<User[]> {
    const params = query ? { query } : {}
    const res = await api.get<User[]>('/connections/users', { params })
    return res.data
  },

  async getAccepted(): Promise<UserConnection[]> {
    const res = await api.get<UserConnection[]>('/connections')
    return res.data
  },

  async getPendingIncoming(): Promise<UserConnection[]> {
    const res = await api.get<UserConnection[]>('/connections/pending')
    return res.data
  },

  async getIncomingRequests(): Promise<UserConnection[]> {
    return this.getPendingIncoming()
  },

  async getPendingSent(): Promise<UserConnection[]> {
    const res = await api.get<UserConnection[]>('/connections/sent')
    return res.data
  },

  async sendRequest(targetUserId: number): Promise<UserConnection> {
    const res = await api.post<UserConnection>(`/connections/request/${targetUserId}`)
    return res.data
  },

  async sendRequestByTag(userTag: string): Promise<UserConnection> {
    const clean = encodeURIComponent((userTag || '').replace(/^[#@\s]+/, '').replace(/[#@\s]+$/, '').trim().toUpperCase())
    const res = await api.post<UserConnection>(`/connections/request/tag/${clean}`)
    return res.data
  },

  async accept(connectionId: number): Promise<UserConnection> {
    const res = await api.post<UserConnection>(`/connections/${connectionId}/accept`)
    return res.data
  },

  async acceptRequest(connectionId: number): Promise<UserConnection> {
    return this.accept(connectionId)
  },

  async decline(connectionId: number): Promise<UserConnection> {
    const res = await api.post<UserConnection>(`/connections/${connectionId}/decline`)
    return res.data
  },

  async declineRequest(connectionId: number): Promise<UserConnection> {
    return this.decline(connectionId)
  },

  async remove(connectionId: number): Promise<void> {
    await api.delete(`/connections/${connectionId}`)
  },
}

export default connectionService
