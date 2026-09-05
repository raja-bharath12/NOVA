import api from './api'
import websocketService from './websocketService'
import type { WhiteboardCursor, WhiteboardItem, WhiteboardOp } from '../types'

export const whiteboardService = {
  async getAll(): Promise<WhiteboardItem[]> {
    const res = await api.get<WhiteboardItem[]>('/whiteboards')
    return res.data
  },

  async getMeetingWhiteboards(roomCode: string): Promise<WhiteboardItem[]> {
    const res = await api.get<WhiteboardItem[]>(`/whiteboards/meeting/${roomCode}`)
    return res.data
  },

  async getById(id: number): Promise<WhiteboardItem> {
    const res = await api.get<WhiteboardItem>(`/whiteboards/${id}`)
    return res.data
  },

  async create(title: string, meetingRoomCode?: string): Promise<WhiteboardItem> {
    const res = await api.post<WhiteboardItem>('/whiteboards', {
      title,
      meetingRoomCode,
    })
    return res.data
  },

  async save(
    id: number,
    data: { title?: string; canvasData?: string; snapshotUrl?: string }
  ): Promise<WhiteboardItem> {
    const res = await api.put<WhiteboardItem>(`/whiteboards/${id}`, data)
    return res.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/whiteboards/${id}`)
  },

  // ===== Real-Time Collaboration STOMP Bindings =====

  subscribeToWhiteboard(
    boardId: number,
    onOp: (op: WhiteboardOp) => void,
    onCursor?: (cursor: WhiteboardCursor) => void
  ): () => void {
    const client = (websocketService as any).client
    if (!client || !websocketService.isConnected()) {
      return () => {}
    }

    const opTopic = `/topic/whiteboard.${boardId}.ops`
    const cursorTopic = `/topic/whiteboard.${boardId}.cursors`

    const subOp = client.subscribe(opTopic, (msg: any) => {
      try {
        const op: WhiteboardOp = JSON.parse(msg.body)
        onOp(op)
      } catch (err) {
        console.error('Failed to parse whiteboard op', err)
      }
    })

    let subCursor: any = null
    if (onCursor) {
      subCursor = client.subscribe(cursorTopic, (msg: any) => {
        try {
          const cursor: WhiteboardCursor = JSON.parse(msg.body)
          onCursor(cursor)
        } catch (err) {
          console.error('Failed to parse whiteboard cursor', err)
        }
      })
    }

    return () => {
      subOp.unsubscribe()
      if (subCursor) subCursor.unsubscribe()
    }
  },

  subscribeToMeetingWhiteboard(
    roomCode: string,
    onOp: (op: WhiteboardOp) => void,
    onCursor?: (cursor: WhiteboardCursor) => void
  ): () => void {
    const client = (websocketService as any).client
    if (!client || !websocketService.isConnected()) {
      return () => {}
    }

    const opTopic = `/topic/meeting.${roomCode}.whiteboard.ops`
    const cursorTopic = `/topic/meeting.${roomCode}.whiteboard.cursors`

    const subOp = client.subscribe(opTopic, (msg: any) => {
      try {
        const op: WhiteboardOp = JSON.parse(msg.body)
        onOp(op)
      } catch (err) {
        console.error('Failed to parse meeting whiteboard op', err)
      }
    })

    let subCursor: any = null
    if (onCursor) {
      subCursor = client.subscribe(cursorTopic, (msg: any) => {
        try {
          const cursor: WhiteboardCursor = JSON.parse(msg.body)
          onCursor(cursor)
        } catch (err) {
          console.error('Failed to parse meeting whiteboard cursor', err)
        }
      })
    }

    return () => {
      subOp.unsubscribe()
      if (subCursor) subCursor.unsubscribe()
    }
  },

  sendOp(boardId: number, op: WhiteboardOp) {
    const client = (websocketService as any).client
    if (!client || !websocketService.isConnected()) return

    client.publish({
      destination: `/app/whiteboard.${boardId}.draw`,
      body: JSON.stringify(op),
    })
  },

  sendMeetingOp(roomCode: string, op: WhiteboardOp) {
    const client = (websocketService as any).client
    if (!client || !websocketService.isConnected()) return

    client.publish({
      destination: `/app/meeting.${roomCode}.whiteboard.draw`,
      body: JSON.stringify(op),
    })
  },

  sendCursor(boardId: number, cursor: WhiteboardCursor) {
    const client = (websocketService as any).client
    if (!client || !websocketService.isConnected()) return

    client.publish({
      destination: `/app/whiteboard.${boardId}.cursor`,
      body: JSON.stringify(cursor),
    })
  },

  sendMeetingCursor(roomCode: string, cursor: WhiteboardCursor) {
    const client = (websocketService as any).client
    if (!client || !websocketService.isConnected()) return

    client.publish({
      destination: `/app/meeting.${roomCode}.whiteboard.cursor`,
      body: JSON.stringify(cursor),
    })
  },
}

export default whiteboardService
