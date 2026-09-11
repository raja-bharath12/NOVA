import api from './api'
import type { MusicTrack, MusicRoom, MusicChatMessage } from '../types'

export const musicService = {
  // 1. Upload & List Audio Tracks
  async uploadTrack(
    file: File,
    title?: string,
    artist?: string,
    album?: string,
    duration?: number,
    coverArtUrl?: string,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<MusicTrack> {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    if (artist) formData.append('artist', artist)
    if (album) formData.append('album', album)
    if (duration) formData.append('duration', duration.toString())
    if (coverArtUrl) formData.append('coverArtUrl', coverArtUrl)

    const { data } = await api.post<MusicTrack>('/music/tracks/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    })
    return data
  },

  async getTracks(): Promise<MusicTrack[]> {
    const { data } = await api.get<MusicTrack[]>('/music/tracks')
    return data
  },

  async getTrack(id: number): Promise<MusicTrack> {
    const { data } = await api.get<MusicTrack>(`/music/tracks/${id}`)
    return data
  },

  // 2. Room Management
  async createRoom(title?: string, initialTrackId?: number, isCollaborative: boolean = true): Promise<MusicRoom> {
    const { data } = await api.post<MusicRoom>('/music/rooms', {
      title,
      initialTrackId,
      isCollaborative,
    })
    return data
  },

  async getRoom(roomCode: string): Promise<MusicRoom> {
    const { data } = await api.get<MusicRoom>(`/music/rooms/${roomCode}`)
    return data
  },

  async joinRoom(roomCode: string): Promise<MusicRoom> {
    const { data } = await api.post<MusicRoom>(`/music/rooms/${roomCode}/join`)
    return data
  },

  async leaveRoom(roomCode: string): Promise<void> {
    await api.post(`/music/rooms/${roomCode}/leave`)
  },

  async updatePlayback(
    roomCode: string,
    position?: number,
    isPlaying?: boolean,
    playbackRate?: number
  ): Promise<MusicRoom> {
    const params: Record<string, any> = {}
    if (position !== undefined) params.position = position
    if (isPlaying !== undefined) params.isPlaying = isPlaying
    if (playbackRate !== undefined) params.playbackRate = playbackRate

    const { data } = await api.post<MusicRoom>(`/music/rooms/${roomCode}/playback`, null, { params })
    return data
  },

  async changeTrack(roomCode: string, trackId: number): Promise<MusicRoom> {
    const { data } = await api.post<MusicRoom>(`/music/rooms/${roomCode}/track`, { trackId })
    return data
  },

  // 3. Queue Management
  async addToQueue(roomCode: string, trackId: number): Promise<MusicRoom> {
    const { data } = await api.post<MusicRoom>(`/music/rooms/${roomCode}/queue`, { trackId })
    return data
  },

  async removeFromQueue(roomCode: string, itemId: number): Promise<MusicRoom> {
    const { data } = await api.delete<MusicRoom>(`/music/rooms/${roomCode}/queue/${itemId}`)
    return data
  },

  async advanceNextTrack(roomCode: string): Promise<MusicRoom> {
    const { data } = await api.post<MusicRoom>(`/music/rooms/${roomCode}/queue/next`)
    return data
  },

  // 4. In-Room Chat
  async getMessages(roomCode: string): Promise<MusicChatMessage[]> {
    const { data } = await api.get<MusicChatMessage[]>(`/music/rooms/${roomCode}/messages`)
    return data
  },

  async sendMessage(roomCode: string, content: string): Promise<MusicChatMessage> {
    const { data } = await api.post<MusicChatMessage>(`/music/rooms/${roomCode}/messages`, { content })
    return data
  },

  // 5. Stream URL Helper
  getStreamUrl(trackId: number): string {
    const token = localStorage.getItem('mystic_token') || ''
    const base = api.defaults.baseURL || '/api'
    return `${base}/music/tracks/${trackId}/stream?token=${encodeURIComponent(token)}`
  },
}

