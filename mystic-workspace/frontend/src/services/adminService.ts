import api from './api'
import type { AdminStats, AdminRoomItem, AdminFileItem, User } from '../types'

export const adminService = {
  async getStats(): Promise<AdminStats> {
    const { data } = await api.get<AdminStats>('/admin/stats')
    return data
  },

  async getUsers(): Promise<User[]> {
    const { data } = await api.get<User[]>('/admin/users')
    return data
  },

  async updateUserRole(userId: number, role: 'ADMIN' | 'USER'): Promise<User> {
    const { data } = await api.put<User>(`/admin/users/${userId}/role`, { role })
    return data
  },

  async deleteUser(userId: number): Promise<{ success: boolean; message: string }> {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/admin/users/${userId}`)
    return data
  },

  async bulkDeleteUsers(userIds: number[]): Promise<{ success: boolean; deletedCount: number; message: string }> {
    const { data } = await api.post<{ success: boolean; deletedCount: number; message: string }>('/admin/users/bulk-delete', { userIds })
    return data
  },

  async getRooms(): Promise<AdminRoomItem[]> {
    const { data } = await api.get<AdminRoomItem[]>('/admin/rooms')
    return data
  },

  async terminateWatchRoom(roomCode: string): Promise<{ success: boolean; message: string }> {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/admin/rooms/watch/${roomCode}`)
    return data
  },

  async getFiles(): Promise<AdminFileItem[]> {
    const { data } = await api.get<AdminFileItem[]>('/admin/files')
    return data
  },

  async deleteFile(fileId: number): Promise<{ success: boolean; message: string }> {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/admin/files/${fileId}`)
    return data
  },
}
