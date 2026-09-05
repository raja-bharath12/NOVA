import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { WS_BASE_URL } from './api'
import type { CallSignal, MeetingSignal, Message, PresenceEvent, ReadReceiptEvent, TypingEvent } from '../types'

class WebSocketService {
  private client: Client | null = null
  private connected = false
  private subscriptions: Map<string, StompSubscription> = new Map()
  private typingTimeouts: Map<number, ReturnType<typeof setTimeout>> = new Map()
  private connectionListeners: ((connected: boolean) => void)[] = []

  connect(token: string) {
    if (this.client && this.connected) return

    const socketFactory = () => new SockJS(WS_BASE_URL)

    this.client = new Client({
      webSocketFactory: socketFactory,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (msg: string) => {
        // console.debug('[STOMP]', msg)
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    })

    this.client.onConnect = () => {
      this.connected = true
      this.connectionListeners.forEach((cb) => cb(true))
    }

    this.client.onDisconnect = () => {
      this.connected = false
      this.subscriptions.clear()
      this.connectionListeners.forEach((cb) => cb(false))
    }

    this.client.onStompError = (frame) => {
      console.warn('STOMP broker error:', frame.headers['message'])
    }

    this.client.activate()
  }

  disconnect() {
    if (this.client) {
      this.subscriptions.forEach((sub) => sub.unsubscribe())
      this.subscriptions.clear()
      this.client.deactivate()
      this.client = null
      this.connected = false
      this.connectionListeners.forEach((cb) => cb(false))
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connectionListeners.push(cb)
    cb(this.connected)
    return () => {
      this.connectionListeners = this.connectionListeners.filter((l) => l !== cb)
    }
  }

  // ===== Chat Subscriptions =====

  subscribeToConversation(
    conversationId: number,
    onMessage: (msg: Message) => void,
    onTyping?: (typing: TypingEvent) => void,
    onReadReceipt?: (receipt: ReadReceiptEvent) => void
  ): () => void {
    if (!this.client || !this.connected) return () => {}

    const topicMsg = `/topic/conversations.${conversationId}`
    const subMsg = this.client.subscribe(topicMsg, (imsg: IMessage) => {
      try {
        const data: Message = JSON.parse(imsg.body)
        onMessage(data)
      } catch (err) {
        console.error('Failed to parse incoming chat message', err)
      }
    })

    let subTyping: StompSubscription | null = null
    if (onTyping) {
      const topicTyping = `/topic/conversations.${conversationId}.typing`
      subTyping = this.client.subscribe(topicTyping, (imsg: IMessage) => {
        try {
          const data: TypingEvent = JSON.parse(imsg.body)
          onTyping(data)
        } catch (err) {
          console.error('Failed to parse typing event', err)
        }
      })
    }

    let subReads: StompSubscription | null = null
    if (onReadReceipt) {
      const topicReads = `/topic/conversations.${conversationId}.reads`
      subReads = this.client.subscribe(topicReads, (imsg: IMessage) => {
        try {
          const data: ReadReceiptEvent = JSON.parse(imsg.body)
          onReadReceipt(data)
        } catch (err) {
          console.error('Failed to parse read receipt', err)
        }
      })
    }

    return () => {
      subMsg.unsubscribe()
      subTyping?.unsubscribe()
      subReads?.unsubscribe()
    }
  }

  sendTyping(conversationId: number, isTyping: boolean) {
    if (!this.client || !this.connected) return

    this.client.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ conversationId, isTyping }),
    })
  }

  sendTypingDebounced(conversationId: number) {
    this.sendTyping(conversationId, true)

    if (this.typingTimeouts.has(conversationId)) {
      clearTimeout(this.typingTimeouts.get(conversationId))
    }

    const timeout = setTimeout(() => {
      this.sendTyping(conversationId, false)
      this.typingTimeouts.delete(conversationId)
    }, 2000)

    this.typingTimeouts.set(conversationId, timeout)
  }

  // ===== Presence Subscription =====

  subscribeToPresence(onPresence: (event: PresenceEvent) => void): () => void {
    if (!this.client || !this.connected) return () => {}

    const sub = this.client.subscribe('/topic/presence', (imsg: IMessage) => {
      try {
        const data: PresenceEvent = JSON.parse(imsg.body)
        onPresence(data)
      } catch (err) {
        console.error('Failed to parse presence notification', err)
      }
    })

    return () => sub.unsubscribe()
  }

  updatePresence(status: 'ONLINE' | 'AWAY' | 'OFFLINE') {
    if (!this.client || !this.connected) return
    this.client.publish({
      destination: '/app/presence.update',
      body: status,
    })
  }

  // ===== Notifications & 1:1 Calls =====

  subscribeToUserNotifications(
    onNotification: (msg: Message) => void,
    onCallSignal?: (signal: CallSignal) => void
  ): () => void {
    if (!this.client || !this.connected) return () => {}

    const subNotif = this.client.subscribe('/user/queue/notifications', (imsg: IMessage) => {
      try {
        const data: Message = JSON.parse(imsg.body)
        onNotification(data)
      } catch (err) {
        console.error('Failed to parse user notification', err)
      }
    })

    let subCall: StompSubscription | null = null
    if (onCallSignal) {
      subCall = this.client.subscribe('/user/queue/call.signal', (imsg: IMessage) => {
        try {
          const data: CallSignal = JSON.parse(imsg.body)
          onCallSignal(data)
        } catch (err) {
          console.error('Failed to parse call signal', err)
        }
      })
    }

    return () => {
      subNotif.unsubscribe()
      subCall?.unsubscribe()
    }
  }

  sendCallSignal(signal: CallSignal) {
    if (!this.client || !this.connected) return
    this.client.publish({
      destination: '/app/call.signal',
      body: JSON.stringify(signal),
    })
  }

  // ===== Meeting Room Mesh Signaling =====

  subscribeToMeeting(
    roomCode: string,
    onSignal: (signal: MeetingSignal) => void,
    onChat?: (chat: MeetingSignal) => void
  ): () => void {
    if (!this.client || !this.connected) return () => {}

    const subSignal = this.client.subscribe(`/topic/meeting.${roomCode}.signal`, (imsg: IMessage) => {
      try {
        const data: MeetingSignal = JSON.parse(imsg.body)
        onSignal(data)
      } catch (err) {
        console.error('Failed to parse meeting signal', err)
      }
    })

    let subChat: StompSubscription | null = null
    if (onChat) {
      subChat = this.client.subscribe(`/topic/meeting.${roomCode}.chat`, (imsg: IMessage) => {
        try {
          const data: MeetingSignal = JSON.parse(imsg.body)
          onChat(data)
        } catch (err) {
          console.error('Failed to parse meeting chat', err)
        }
      })
    }

    return () => {
      subSignal.unsubscribe()
      subChat?.unsubscribe()
    }
  }

  sendMeetingSignal(signal: MeetingSignal) {
    if (!this.client || !this.connected) return
    this.client.publish({
      destination: '/app/meeting.signal',
      body: JSON.stringify(signal),
    })
  }

  sendMeetingChat(signal: MeetingSignal) {
    if (!this.client || !this.connected) return
    this.client.publish({
      destination: '/app/meeting.chat',
      body: JSON.stringify(signal),
    })
  }
}

export const websocketService = new WebSocketService()
export default websocketService
