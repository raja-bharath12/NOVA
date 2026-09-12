import api from './api'
import type { RoomState, CreateRoomPayload, JoinRoomPayload, DrawAction } from '../types/scribble'

export const scribbleService = {
  createRoom: async (payload?: CreateRoomPayload): Promise<RoomState> => {
    const res = await api.post('/scribble/rooms', payload || {})
    return res.data
  },

  listPublicRooms: async (): Promise<RoomState[]> => {
    const res = await api.get('/scribble/rooms')
    return res.data
  },

  getRoomState: async (roomCode: string): Promise<RoomState> => {
    const clean = roomCode.trim().toUpperCase()
    const res = await api.get(`/scribble/rooms/${clean}`)
    return res.data
  },

  joinRoom: async (roomCode: string, payload?: JoinRoomPayload): Promise<RoomState> => {
    const clean = roomCode.trim().toUpperCase()
    const res = await api.post(`/scribble/rooms/${clean}/join`, payload || {})
    return res.data
  },

  getCanvasSnapshot: async (roomCode: string): Promise<DrawAction[]> => {
    const clean = roomCode.trim().toUpperCase()
    const res = await api.get(`/scribble/rooms/${clean}/canvas`)
    return res.data
  },
}

export default scribbleService
