import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { websocketService } from '../services/websocketService'
import { webrtcService } from '../services/webrtcService'
import { notificationService } from '../services/notificationService'
import { eventService } from '../services/eventService'
import { connectionService } from '../services/connectionService'
import type { CallSignal, Message, PresenceEvent, AppNotification } from '../types'

interface CallContextValue {
  incomingCall: CallSignal | null
  activeCall: {
    targetUserId: number
    targetUserName: string
    isVideo: boolean
    status: 'RINGING' | 'CONNECTED' | 'ENDED'
  } | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMicMuted: boolean
  isCamOff: boolean
  notifications: AppNotification[]
  unreadNotifsCount: number
  onlineUserIds: Set<number>
  permissionStatus: NotificationPermission
  requestNotificationPermission: () => Promise<boolean>
  initiateCall: (targetUserId: number, targetUserName: string, isVideo: boolean) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleMic: () => void
  toggleCam: () => void
  clearNotifications: () => void
  dismissNotification: (id: string) => void
  acceptConnectionRequest: (connectionId: number) => Promise<void>
  declineConnectionRequest: (connectionId: number) => Promise<void>
}

const CallContext = createContext<CallContextValue | undefined>(undefined)

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [incomingCall, setIncomingCall] = useState<CallSignal | null>(null)
  const [activeCall, setActiveCall] = useState<{
    targetUserId: number
    targetUserName: string
    isVideo: boolean
    status: 'RINGING' | 'CONNECTED' | 'ENDED'
  } | null>(null)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set())
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    notificationService.getPermissionStatus()
  )

  const activeCallRef = useRef(activeCall)
  activeCallRef.current = activeCall

  useEffect(() => {
    const token = localStorage.getItem('mystic_token')
    if (!token || !user) return

    websocketService.connect(token)

    const unsubWS = websocketService.onConnectionChange((connected) => {
      if (connected) {
        websocketService.updatePresence('ONLINE')
      }
    })

    const unsubNotifs = websocketService.subscribeToUserNotifications(
      (msg: Message) => {
        const notif = notificationService.notifyNewChatMessage(msg, user.id)
        if (notif) {
          setNotifications((prev) => [notif, ...prev])
          setUnreadNotifsCount((prev) => prev + 1)
        }
      },
      (signal: CallSignal) => {
        handleIncomingCallSignal(signal)
      },
      (event: any) => {
        handleConnectionEvent(event)
      }
    )

    const unsubPresence = websocketService.subscribeToPresence((event: PresenceEvent) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev)
        if (event.status === 'ONLINE') {
          next.add(event.userId)
        } else if (event.status === 'OFFLINE') {
          next.delete(event.userId)
        }
        return next
      })
    })

    checkCalendarReminders()
    const reminderInterval = setInterval(checkCalendarReminders, 5 * 60 * 1000)

    return () => {
      unsubWS()
      unsubNotifs()
      unsubPresence()
      clearInterval(reminderInterval)
      websocketService.disconnect()
    }
  }, [user])

  function handleConnectionEvent(event: any) {
    if (!event || !event.connection) return
    const conn = event.connection

    if (event.type === 'CONNECTION_REQUEST') {
      const notif: AppNotification = {
        id: `conn-req-${conn.id}-${Date.now()}`,
        type: 'CONNECTION_REQUEST',
        title: `🤝 Connection Request`,
        body: `${conn.requester?.name || 'Someone'} wants to connect with you on Mystic`,
        connectionId: conn.id,
        requesterId: conn.requester?.id,
        targetUrl: '/chat',
        createdAt: new Date().toISOString(),
      }
      setNotifications((prev) => [notif, ...prev])
      setUnreadNotifsCount((prev) => prev + 1)

      notificationService.showNativeNotification(`🤝 Connection Request`, {
        body: `${conn.requester?.name || 'A user'} wants to connect with you on Mystic.`,
        url: '/chat',
        tag: `conn-req-${conn.id}`,
      })
    } else if (event.type === 'CONNECTION_ACCEPTED') {
      const partnerName = conn.requester?.id === user?.id ? conn.recipient?.name : conn.requester?.name
      const notif: AppNotification = {
        id: `conn-acc-${conn.id}-${Date.now()}`,
        type: 'CONNECTION_ACCEPTED',
        title: `🎉 Connected on Mystic!`,
        body: `${partnerName || 'Your connection'} accepted your request. You can now chat!`,
        targetUrl: '/chat',
        createdAt: new Date().toISOString(),
      }
      setNotifications((prev) => [notif, ...prev])
      setUnreadNotifsCount((prev) => prev + 1)

      notificationService.showNativeNotification(`🎉 Connected!`, {
        body: `You and ${partnerName} are now connected on Mystic.`,
        url: '/chat',
        tag: `conn-acc-${conn.id}`,
      })
    }
  }

  async function acceptConnectionRequest(connectionId: number) {
    try {
      await connectionService.accept(connectionId)
      setNotifications((prev) => prev.filter((n) => n.connectionId !== connectionId))
    } catch (err) {
      console.error('Failed to accept connection request:', err)
      throw err
    }
  }

  async function declineConnectionRequest(connectionId: number) {
    try {
      await connectionService.decline(connectionId)
      setNotifications((prev) => prev.filter((n) => n.connectionId !== connectionId))
    } catch (err) {
      console.error('Failed to decline connection request:', err)
      throw err
    }
  }

  async function checkCalendarReminders() {
    try {
      const events = await eventService.list()
      const newReminders = notificationService.evaluateCalendarReminders(events)
      if (newReminders.length > 0) {
        setNotifications((prev) => [...newReminders, ...prev])
        setUnreadNotifsCount((prev) => prev + newReminders.length)
      }
    } catch (err) {
      // Background check error (ignore silent fails)
    }
  }

  async function requestNotificationPermission(): Promise<boolean> {
    const granted = await notificationService.requestPermission()
    setPermissionStatus(notificationService.getPermissionStatus())
    if (granted) {
      notificationService.showNativeNotification('🔔 Notifications Enabled', {
        body: 'You will receive instant alerts for messages, calls, and calendar reminders.',
        url: '/',
      })
    }
    return granted
  }

  function handleIncomingCallSignal(signal: CallSignal) {
    if (signal.type === 'CALL_REQUEST') {
      if (activeCallRef.current) {
        websocketService.sendCallSignal({
          type: 'CALL_BUSY',
          senderId: user!.id,
          senderName: user!.name,
          targetUserId: signal.senderId,
          isVideo: signal.isVideo,
        })
        return
      }
      setIncomingCall(signal)

      notificationService.showNativeNotification(`📞 Incoming ${signal.isVideo ? 'Video' : 'Voice'} Call`, {
        body: `${signal.senderName || 'A teammate'} is calling you...`,
        url: '/chat',
        tag: 'incoming-call',
      })
    } else if (signal.type === 'CALL_REJECT' || signal.type === 'CALL_BUSY' || signal.type === 'CALL_END') {
      endCall()
    } else if (signal.type === 'OFFER' || signal.type === 'ANSWER' || signal.type === 'ICE_CANDIDATE') {
      webrtcService.handleCallSignal(signal)
    }
  }

  async function initiateCall(targetUserId: number, targetUserName: string, isVideo: boolean) {
    if (!user) return

    try {
      setActiveCall({
        targetUserId,
        targetUserName,
        isVideo,
        status: 'RINGING',
      })

      await webrtcService.startCall(
        targetUserId,
        user.id,
        user.name,
        isVideo,
        (rStream) => {
          setRemoteStream(rStream)
          setActiveCall((prev) => (prev ? { ...prev, status: 'CONNECTED' } : null))
        },
        () => {
          endCall()
        }
      )

      setLocalStream(webrtcService.getLocalStream())
    } catch (err) {
      console.error('Failed to initiate call:', err)
      endCall()
    }
  }

  async function acceptCall() {
    if (!incomingCall || !user) return

    try {
      setActiveCall({
        targetUserId: incomingCall.senderId,
        targetUserName: incomingCall.senderName,
        isVideo: incomingCall.isVideo,
        status: 'CONNECTED',
      })

      await webrtcService.acceptCall(
        incomingCall,
        user.id,
        user.name,
        (rStream) => {
          setRemoteStream(rStream)
        },
        () => {
          endCall()
        }
      )

      setLocalStream(webrtcService.getLocalStream())
      setIncomingCall(null)
    } catch (err) {
      console.error('Failed to accept call:', err)
      endCall()
    }
  }

  function rejectCall() {
    if (!incomingCall || !user) return

    websocketService.sendCallSignal({
      type: 'CALL_REJECT',
      senderId: user.id,
      senderName: user.name,
      targetUserId: incomingCall.senderId,
      isVideo: incomingCall.isVideo,
    })

    setIncomingCall(null)
  }

  function endCall() {
    if (activeCall && user) {
      webrtcService.endCall(activeCall.targetUserId, user.id, user.name)
    } else {
      webrtcService.endCall()
    }

    setIncomingCall(null)
    setActiveCall(null)
    setLocalStream(null)
    setRemoteStream(null)
    setIsMicMuted(false)
    setIsCamOff(false)
  }

  function toggleMic() {
    const nextState = !isMicMuted
    setIsMicMuted(nextState)
    webrtcService.toggleMicrophone(!nextState)
  }

  function toggleCam() {
    const nextState = !isCamOff
    setIsCamOff(nextState)
    webrtcService.toggleCamera(!nextState)
  }

  function clearNotifications() {
    setUnreadNotifsCount(0)
  }

  function dismissNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        isMicMuted,
        isCamOff,
        notifications,
        unreadNotifsCount,
        onlineUserIds,
        permissionStatus,
        requestNotificationPermission,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCam,
        acceptConnectionRequest,
        declineConnectionRequest,
        clearNotifications,
        dismissNotification,
      }}
    >
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within a CallProvider')
  return ctx
}
