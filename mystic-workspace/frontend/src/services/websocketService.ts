import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { WS_BASE_URL } from './api'
import type { CallSignal, MeetingSignal, Message, PresenceEvent, ReadReceiptEvent, TypingEvent } from '../types'

interface ActiveSub {
  id: string
  destination: string
  callback: (imsg: IMessage) => void
  sub?: StompSubscription
}

class WebSocketService {
  private client: Client | null = null
  private connected = false
  private activeSubs: Map<string, ActiveSub> = new Map()
  private typingTimeouts: Map<number, ReturnType<typeof setTimeout>> = new Map()
  private connectionListeners: ((connected: boolean) => void)[] = []
  private subCounter = 0

  connect(token: string) {
    if (this.client && this.connected) return

    const socketFactory = () => new SockJS(WS_BASE_URL)

    this.client = new Client({
      webSocketFactory: socketFactory,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (_msg: string) => {
        // console.debug('[STOMP]', _msg)
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    })

    this.client.onConnect = () => {
      this.connected = true
      // Auto-subscribe all queued/active subscriptions on connect or reconnect
      this.resubscribeAll()
      this.connectionListeners.forEach((cb) => cb(true))
    }

    this.client.onDisconnect = () => {
      this.connected = false
      // Clear active StompSubscription instances, but retain registry for reconnect
      this.activeSubs.forEach((item) => {
        item.sub = undefined
      })
      this.connectionListeners.forEach((cb) => cb(false))
    }

    this.client.onStompError = (frame) => {
      console.warn('STOMP broker error:', frame.headers['message'])
    }

    this.client.onWebSocketClose = () => {
      this.connected = false
      this.activeSubs.forEach((item) => {
        item.sub = undefined
      })
      this.connectionListeners.forEach((cb) => cb(false))
    }

    this.client.activate()
  }

  private resubscribeAll() {
    if (!this.client || !this.connected) return

    this.activeSubs.forEach((item) => {
      try {
        if (!item.sub) {
          item.sub = this.client!.subscribe(item.destination, item.callback)
        }
      } catch (err) {
        console.error(`Failed to subscribe to ${item.destination}:`, err)
      }
    })
  }

  private registerSubscription(destination: string, callback: (imsg: IMessage) => void): () => void {
    const subId = `sub_${++this.subCounter}_${Date.now()}`
    const item: ActiveSub = {
      id: subId,
      destination,
      callback,
    }

    if (this.client && this.connected) {
      try {
        item.sub = this.client.subscribe(destination, callback)
      } catch (err) {
        console.error(`Error subscribing immediately to ${destination}:`, err)
      }
    }

    this.activeSubs.set(subId, item)

    return () => {
      const existing = this.activeSubs.get(subId)
      if (existing) {
        try {
          existing.sub?.unsubscribe()
        } catch (err) {}
        this.activeSubs.delete(subId)
      }
    }
  }

  disconnect() {
    if (this.client) {
      this.activeSubs.forEach((item) => {
        try {
          item.sub?.unsubscribe()
        } catch (err) {}
      })
      this.activeSubs.clear()
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
    const topicMsg = `/topic/conversations.${conversationId}`
    const unsubMsg = this.registerSubscription(topicMsg, (imsg: IMessage) => {
      try {
        const data: Message = JSON.parse(imsg.body)
        onMessage(data)
      } catch (err) {
        console.error('Failed to parse incoming chat message', err)
      }
    })

    let unsubTyping: (() => void) | null = null
    if (onTyping) {
      const topicTyping = `/topic/conversations.${conversationId}.typing`
      unsubTyping = this.registerSubscription(topicTyping, (imsg: IMessage) => {
        try {
          const data: TypingEvent = JSON.parse(imsg.body)
          onTyping(data)
        } catch (err) {
          console.error('Failed to parse typing event', err)
        }
      })
    }

    let unsubReads: (() => void) | null = null
    if (onReadReceipt) {
      const topicReads = `/topic/conversations.${conversationId}.reads`
      unsubReads = this.registerSubscription(topicReads, (imsg: IMessage) => {
        try {
          const data: ReadReceiptEvent = JSON.parse(imsg.body)
          onReadReceipt(data)
        } catch (err) {
          console.error('Failed to parse read receipt', err)
        }
      })
    }

    return () => {
      unsubMsg()
      unsubTyping?.()
      unsubReads?.()
    }
  }

  sendTyping(conversationId: number, isTyping: boolean) {
    if (!this.client || !this.connected) return

    try {
      this.client.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({ conversationId, isTyping }),
      })
    } catch (err) {
      console.warn('Failed to publish typing event', err)
    }
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
    return this.registerSubscription('/topic/presence', (imsg: IMessage) => {
      try {
        const data: PresenceEvent = JSON.parse(imsg.body)
        onPresence(data)
      } catch (err) {
        console.error('Failed to parse presence notification', err)
      }
    })
  }

  updatePresence(status: 'ONLINE' | 'AWAY' | 'OFFLINE') {
    if (!this.client || !this.connected) return
    try {
      this.client.publish({
        destination: '/app/presence.update',
        body: status,
      })
    } catch (err) {
      console.warn('Failed to update presence', err)
    }
  }

  // ===== Notifications & 1:1 Calls =====

  subscribeToUserNotifications(
    onNotification: (msg: Message) => void,
    onCallSignal?: (signal: CallSignal) => void,
    onConnectionEvent?: (event: any) => void
  ): () => void {
    const unsubNotif = this.registerSubscription('/user/queue/notifications', (imsg: IMessage) => {
      try {
        const data = JSON.parse(imsg.body)
        if (
          data.type === 'CONNECTION_REQUEST' ||
          data.type === 'CONNECTION_ACCEPTED' ||
          data.type === 'CONNECTION_DECLINED'
        ) {
          onConnectionEvent?.(data)
        } else {
          onNotification(data as Message)
        }
      } catch (err) {
        console.error('Failed to parse user notification', err)
      }
    })

    let unsubConn: (() => void) | null = null
    if (onConnectionEvent) {
      unsubConn = this.registerSubscription('/user/queue/connections', (imsg: IMessage) => {
        try {
          const data = JSON.parse(imsg.body)
          onConnectionEvent(data)
        } catch (err) {
          console.error('Failed to parse connection event', err)
        }
      })
    }

    let unsubCall: (() => void) | null = null
    if (onCallSignal) {
      unsubCall = this.registerSubscription('/user/queue/call.signal', (imsg: IMessage) => {
        try {
          const data: CallSignal = JSON.parse(imsg.body)
          onCallSignal(data)
        } catch (err) {
          console.error('Failed to parse call signal', err)
        }
      })
    }

    return () => {
      unsubNotif()
      unsubConn?.()
      unsubCall?.()
    }
  }

  sendCallSignal(signal: CallSignal) {
    if (!this.client || !this.connected) return
    try {
      this.client.publish({
        destination: '/app/call.signal',
        body: JSON.stringify(signal),
      })
    } catch (err) {
      console.warn('Failed to publish call signal', err)
    }
  }

  // ===== Meeting Room Mesh Signaling =====

  subscribeToMeeting(
    roomCode: string,
    onSignal: (signal: MeetingSignal) => void,
    onChat?: (chat: MeetingSignal) => void
  ): () => void {
    const unsubSignal = this.registerSubscription(`/topic/meeting.${roomCode}.signal`, (imsg: IMessage) => {
      try {
        const data: MeetingSignal = JSON.parse(imsg.body)
        onSignal(data)
      } catch (err) {
        console.error('Failed to parse meeting signal', err)
      }
    })

    let unsubChat: (() => void) | null = null
    if (onChat) {
      unsubChat = this.registerSubscription(`/topic/meeting.${roomCode}.chat`, (imsg: IMessage) => {
        try {
          const data: MeetingSignal = JSON.parse(imsg.body)
          onChat(data)
        } catch (err) {
          console.error('Failed to parse meeting chat', err)
        }
      })
    }

    return () => {
      unsubSignal()
      unsubChat?.()
    }
  }

  sendMeetingSignal(signal: MeetingSignal) {
    if (!this.client || !this.connected) return
    try {
      this.client.publish({
        destination: '/app/meeting.signal',
        body: JSON.stringify(signal),
      })
    } catch (err) {
      console.warn('Failed to publish meeting signal', err)
    }
  }

  sendMeetingChat(signal: MeetingSignal) {
    if (!this.client || !this.connected) return
    try {
      this.client.publish({
        destination: '/app/meeting.chat',
        body: JSON.stringify(signal),
      })
    } catch (err) {
      console.warn('Failed to publish meeting chat', err)
    }
  }
}

export const websocketService = new WebSocketService()
export default websocketService
