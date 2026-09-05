import api from './api'
import type { Meeting } from '../types'

export const meetingService = {
  async createInstantMeeting(title?: string, description?: string): Promise<Meeting> {
    const res = await api.post<Meeting>('/meetings/instant', {
      title,
      description,
    })
    return res.data
  },

  async scheduleMeeting(title: string, scheduledStartTime: string, description?: string): Promise<Meeting> {
    const res = await api.post<Meeting>('/meetings/schedule', {
      title,
      scheduledStartTime,
      description,
    })
    return res.data
  },

  async getUserMeetings(): Promise<Meeting[]> {
    const res = await api.get<Meeting[]>('/meetings')
    return res.data
  },

  async getMeeting(roomCode: string): Promise<Meeting> {
    const res = await api.get<Meeting>(`/meetings/${roomCode}`)
    return res.data
  },

  async joinMeeting(roomCode: string): Promise<Meeting> {
    const res = await api.post<Meeting>(`/meetings/${roomCode}/join`)
    return res.data
  },

  async leaveMeeting(roomCode: string): Promise<void> {
    await api.post(`/meetings/${roomCode}/leave`)
  },
}

export default meetingService
