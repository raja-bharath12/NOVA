import api, { API_BASE_URL, BACKEND_URL } from './api'
import type { WatchMedia, WatchRoom, WatchChatMessage } from '../types'

export const watchService = {
  async uploadMedia(
    file: File,
    title?: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<WatchMedia> {
    const formData = new FormData()
    formData.append('file', file)
    if (title) {
      formData.append('title', title)
    }

    const { data } = await api.post<WatchMedia>('/watch/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })
    return data
  },

  async getMyMedia(): Promise<WatchMedia[]> {
    const { data } = await api.get<WatchMedia[]>('/watch/media')
    return data
  },

  async getMedia(id: number): Promise<WatchMedia> {
    const { data } = await api.get<WatchMedia>(`/watch/media/${id}`)
    return data
  },

  async deleteMedia(id: number): Promise<void> {
    await api.delete(`/watch/media/${id}`)
  },

  async createRoom(mediaId: number, title?: string): Promise<WatchRoom> {
    const { data } = await api.post<WatchRoom>('/watch/rooms', { mediaId, title })
    return data
  },

  async getRoom(roomCode: string): Promise<WatchRoom> {
    const { data } = await api.get<WatchRoom>(`/watch/rooms/${roomCode}`)
    return data
  },

  async joinRoom(roomCode: string): Promise<WatchRoom> {
    const { data } = await api.post<WatchRoom>(`/watch/rooms/${roomCode}/join`)
    return data
  },

  async leaveRoom(roomCode: string): Promise<void> {
    await api.post(`/watch/rooms/${roomCode}/leave`)
  },

  async endRoom(roomCode: string): Promise<WatchRoom> {
    const { data } = await api.post<WatchRoom>(`/watch/rooms/${roomCode}/end`)
    return data
  },

  async getMessages(roomCode: string): Promise<WatchChatMessage[]> {
    const { data } = await api.get<WatchChatMessage[]>(`/watch/rooms/${roomCode}/messages`)
    return data
  },

  getStreamUrl(mediaId: number): string {
    const token = localStorage.getItem('mystic_token') || ''
    const base = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${BACKEND_URL}/api`
    return `${base}/watch/media/${mediaId}/stream?token=${encodeURIComponent(token)}`
  }
}
