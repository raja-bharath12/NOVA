import api from './api'
import type { Task } from '../types'

export const taskService = {
  async list(): Promise<Task[]> {
    const { data } = await api.get<Task[]>('/tasks')
    return data
  },
  async create(task: Partial<Task>): Promise<Task> {
    const { data } = await api.post<Task>('/tasks', task)
    return data
  },
  async update(id: number, task: Partial<Task>): Promise<Task> {
    const { data } = await api.put<Task>(`/tasks/${id}`, task)
    return data
  },
  async toggle(id: number): Promise<Task> {
    const { data } = await api.patch<Task>(`/tasks/${id}/toggle`)
    return data
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/tasks/${id}`)
  },
}
