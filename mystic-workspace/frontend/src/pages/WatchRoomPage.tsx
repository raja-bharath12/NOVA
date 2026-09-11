import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Film,
  Users,
  Copy,
  Check,
  Share2,
  ArrowLeft,
  LogOut,
  Power,
  Shield,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { watchService } from '../services/watchService'
import websocketService from '../services/websocketService'
import type { WatchRoom, WatchChatMessage, WatchControlSignal, WatchRoomMemberInfo } from '../types'
import WatchPlayer from '../components/watch/WatchPlayer'
import WatchChatOverlay from '../components/watch/WatchChatOverlay'

export const WatchRoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [room, setRoom] = useState<WatchRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomEnded, setRoomEnded] = useState(false)
  const [members, setMembers] = useState<WatchRoomMemberInfo[]>([])
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<WatchChatMessage[]>([])
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Player synchronization state
  const [incomingSignal, setIncomingSignal] = useState<WatchControlSignal | null>(null)

  const isHost = Boolean(user && room && room.hostId === user.id)

  // Clean & sanitize roomCode parameter
  const cleanRoomCode = (roomCode || '').trim()

  // Fetch room data and initial messages
  const loadRoomData = useCallback(async () => {
    if (!cleanRoomCode) return
    try {
      setLoading(true)
      setError(null)
      // Attempt joinRoom first to register viewer, fallback to getRoom
      let roomData: WatchRoom
      try {
        roomData = await watchService.joinRoom(cleanRoomCode)
      } catch {
        roomData = await watchService.getRoom(cleanRoomCode)
      }
      setRoom(roomData)
      setMembers(roomData.members || [])

      if (roomData.status === 'ENDED') {
        setRoomEnded(true)
      }

      // Load initial chat history
      try {
        const history = await watchService.getMessages(cleanRoomCode)
        setMessages(history)
      } catch (chatErr) {
        console.warn('Failed to load chat history', chatErr)
      }
    } catch (err: any) {
      console.error('Failed to load watch room', err)
      setError(err?.response?.data?.message || 'Failed to load Watch Room. It may not exist or has expired.')
    } finally {
      setLoading(false)
    }
  }, [cleanRoomCode])

  useEffect(() => {
    loadRoomData()
  }, [loadRoomData])

  // WebSocket connection and subscription
  useEffect(() => {
    const token = localStorage.getItem('mystic_token')
    if (!token || !roomCode) return

    // Ensure STOMP is connected
    websocketService.connect(token)

    // Notify presence JOIN
    websocketService.sendWatchPresence(roomCode, 'JOIN')

    // Periodic heartbeat every 30s
    const heartbeatInterval = setInterval(() => {
      websocketService.sendWatchPresence(roomCode, 'HEARTBEAT')
    }, 30000)

    // Subscribe to room topic
    const unsubscribe = websocketService.subscribeToWatchRoom(roomCode, (event: any) => {
      if (!event) return

      // Handle chat message
      if (event.content && event.senderName) {
        const newMsg: WatchChatMessage = {
          id: event.id || Date.now(),
          roomCode: event.roomCode || roomCode,
          senderId: event.senderId,
          senderName: event.senderName,
          senderEmail: event.senderEmail,
          senderTag: event.senderTag,
          content: event.content,
          createdAt: event.createdAt || new Date().toISOString(),
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id && m.id !== undefined)) return prev
          return [...prev, newMsg]
        })
        if (!isChatOpen) {
          setUnreadCount((c) => c + 1)
        }
        return
      }

      // Handle control signals
      if (event.type) {
        const signal = event as WatchControlSignal

        if (signal.type === 'ROOM_ENDED') {
          setRoomEnded(true)
          showToast('The host has ended this Watch Room.', 'warning')
          return
        }

        if (signal.type === 'JOIN' || signal.type === 'LEAVE') {
          // Reload room to update participants
          watchService.getRoom(roomCode).then((updated: WatchRoom) => {
            setMembers(updated.members || [])
          }).catch(() => {})
          return
        }

        // Playback signals (PLAY, PAUSE, SEEK, SYNC)
        setIncomingSignal({ ...signal })
      }
    })

    return () => {
      clearInterval(heartbeatInterval)
      websocketService.sendWatchPresence(roomCode, 'LEAVE')
      unsubscribe()
    }
  }, [roomCode, isChatOpen, showToast])

  // Handlers for sending outbound control and chat
  const handleSendControl = (signal: Partial<WatchControlSignal>) => {
    if (!roomCode) return
    websocketService.sendWatchControl(roomCode, signal)
  }

  const handleSendMessage = (text: string) => {
    if (!roomCode || !text.trim()) return
    websocketService.sendWatchChat(roomCode, text.trim())
  }

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopiedCode(true)
    showToast('Room code copied to clipboard!', 'success')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/watch/${roomCode}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    showToast('Invite link copied to clipboard!', 'success')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleLeaveRoom = async () => {
    if (!roomCode) return
    try {
      await watchService.leaveRoom(roomCode)
    } catch (err) {}
    navigate('/watch')
  }

  const handleEndRoom = async () => {
    if (!roomCode || !window.confirm('Are you sure you want to end this Watch Room for all viewers?')) return
    try {
      await watchService.endRoom(roomCode)
      showToast('Watch Room ended.', 'info')
      navigate('/watch')
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to end room', 'warning')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-slate-200">Connecting to Watch Room...</h2>
        <p className="text-sm text-slate-500 mt-1">Synchronizing media stream & live channels</p>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/5">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Watch Room Not Found</h2>
        <p className="text-slate-400 text-center max-w-md mb-6">{error || 'This room does not exist or has been ended.'}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadRoomData()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-600/30"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/watch')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-all border border-slate-700 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Watch
          </button>
        </div>
      </div>
    )
  }

  if (roomEnded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-6 shadow-2xl">
          <Film className="w-10 h-10 text-slate-500" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
          Broadcast Concluded
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-2 text-center">Watch Room Ended</h2>
        <p className="text-slate-400 text-center max-w-md mb-8">
          The host has concluded this synchronized watch session. You can create a new room or return to your media library.
        </p>
        <button
          onClick={() => navigate('/watch')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Watch Together
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate('/watch')}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Back to Watch Together"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-bold text-white text-base md:text-lg truncate max-w-[200px] md:max-w-md">
                {room.title}
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE SYNC</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 truncate flex items-center gap-2">
              <span>{room.media?.title || 'Video Stream'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Shield className="w-3 h-3 text-indigo-400" /> Host: {room.hostName}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Room Code Badge */}
          <button
            onClick={handleCopyCode}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-mono font-medium text-slate-300 hover:text-white transition-all shadow-sm"
            title="Click to copy Room Code"
          >
            <span className="text-indigo-400 font-sans font-semibold">CODE:</span>
            <span>{room.roomCode}</span>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Share Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-all"
            title="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">Share</span>
          </button>

          {/* Viewers list trigger */}
          <button
            onClick={() => setShowMembersModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-all"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{members.length || 1}</span>
            <span className="hidden md:inline">Viewers</span>
          </button>

          {/* Host End or Participant Leave */}
          {isHost ? (
            <button
              onClick={handleEndRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-400 hover:text-red-300 transition-all"
              title="End session for everyone"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden md:inline">End Room</span>
            </button>
          ) : (
            <button
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
              title="Leave Room"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace: Full Video Area with YouTube-Style Chat Overlay */}
      <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <div className="w-full h-full flex flex-col justify-center">
          <WatchPlayer
            media={room.media}
            isHost={isHost}
            streamUrl={room.media.streamUrl}
            initialPosition={room.currentPosition}
            initialIsPlaying={room.isPlaying}
            incomingSignal={incomingSignal}
            onSendControl={handleSendControl}
            onToggleChat={() => setIsChatOpen((prev) => !prev)}
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
          />
        </div>

        {/* YouTube-Live-Style Chat Overlay & Notification Stack */}
        <WatchChatOverlay
          roomCode={room.roomCode}
          currentUser={user}
          messages={messages}
          onSendMessage={handleSendMessage}
          isChatOpen={isChatOpen}
          onToggleChat={setIsChatOpen}
          unreadCount={unreadCount}
          onClearUnread={() => setUnreadCount(0)}
        />
      </main>

      {/* Participants Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Live Viewers</h3>
                  <p className="text-xs text-slate-400">{members.length} participant{members.length !== 1 ? 's' : ''} in room</p>
                </div>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-750/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{member.name}</span>
                        {member.userId === user?.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">@{member.userTag || member.email}</p>
                    </div>
                  </div>

                  <div>
                    {member.role === 'HOST' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                        <Shield className="w-3 h-3 text-indigo-400" /> Host
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-700/60 border border-slate-650 text-slate-400 text-xs font-medium">
                        Viewer
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowMembersModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WatchRoomPage
