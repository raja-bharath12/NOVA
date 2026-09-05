import api from './api'
import type { EventItem } from '../types'

export const eventService = {
  async list(): Promise<EventItem[]> {
    const { data } = await api.get<EventItem[]>('/events')
    return data
  },
  async create(event: Partial<EventItem>): Promise<EventItem> {
    const { data } = await api.post<EventItem>('/events', event)
    return data
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/events/${id}`)
  },
  async delete(id: number): Promise<void> {
    await api.delete(`/events/${id}`)
  },
}
