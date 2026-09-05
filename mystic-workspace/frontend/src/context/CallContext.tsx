import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { websocketService } from '../services/websocketService'
import { webrtcService } from '../services/webrtcService'
import type { CallSignal, Message, PresenceEvent } from '../types'

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
  notifications: Message[]
  unreadNotifsCount: number
  onlineUserIds: Set<number>
  initiateCall: (targetUserId: number, targetUserName: string, isVideo: boolean) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleMic: () => void
  toggleCam: () => void
  clearNotifications: () => void
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

  const [notifications, setNotifications] = useState<Message[]>([])
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set())

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
      (msg) => {
        setNotifications((prev) => [msg, ...prev])
        setUnreadNotifsCount((prev) => prev + 1)
      },
      (signal) => {
        handleIncomingCallSignal(signal)
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

    return () => {
      unsubWS()
      unsubNotifs()
      unsubPresence()
      websocketService.disconnect()
    }
  }, [user])

  function handleIncomingCallSignal(signal: CallSignal) {
    if (signal.type === 'CALL_REQUEST') {
      if (activeCallRef.current) {
        // Already on another call
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
    } else if (signal.type === 'CALL_REJECT' || signal.type === 'CALL_BUSY' || signal.type === 'CALL_END') {
      endCall()
    } else if (signal.type === 'OFFER' || signal.type === 'ANSWER' || signal.type === 'ICE_CANDIDATE') {
      webrtcService.handleCallSignal(signal)
    }
  }

  async function initiateCall(targetUserId: number, targetUserName: string, isVideo: boolean) {
    if (!user) return

    setActiveCall({
      targetUserId,
      targetUserName,
      isVideo,
      status: 'RINGING',
    })

    // Send call request to alert target
    websocketService.sendCallSignal({
      type: 'CALL_REQUEST',
      senderId: user.id,
      senderName: user.name,
      targetUserId,
      isVideo,
    })

    try {
      await webrtcService.startCall(
        targetUserId,
        user.id,
        user.name,
        isVideo,
        (stream) => {
          setRemoteStream(stream)
          setActiveCall((prev) => (prev ? { ...prev, status: 'CONNECTED' } : null))
        },
        () => {
          endCall()
        }
      )
      setLocalStream(webrtcService.getLocalStream())
    } catch (err) {
      console.error('Failed to initiate WebRTC call', err)
      endCall()
    }
  }

  async function acceptCall() {
    if (!incomingCall || !user) return

    const caller = incomingCall
    setIncomingCall(null)

    setActiveCall({
      targetUserId: caller.senderId,
      targetUserName: caller.senderName,
      isVideo: caller.isVideo,
      status: 'CONNECTED',
    })

    websocketService.sendCallSignal({
      type: 'CALL_ACCEPT',
      senderId: user.id,
      senderName: user.name,
      targetUserId: caller.senderId,
      isVideo: caller.isVideo,
    })

    try {
      await webrtcService.acceptCall(
        caller,
        user.id,
        user.name,
        (stream) => {
          setRemoteStream(stream)
        },
        () => {
          endCall()
        }
      )
      setLocalStream(webrtcService.getLocalStream())
    } catch (err) {
      console.error('Failed to accept call', err)
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
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCam,
        clearNotifications,
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
