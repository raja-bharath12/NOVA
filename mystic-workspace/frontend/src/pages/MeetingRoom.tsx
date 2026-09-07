import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LiveKitRoom,
  VideoConference,
} from '@livekit/components-react'
import '@livekit/components-styles'
import {
  Copy,
  Check,
  PhoneOff,
  Video,
  Shield,
  Sparkles,
  Users,
  Palette,
  Columns,
  Maximize2,
  Lock,
  Unlock,
  SlidersHorizontal,
  Bell,
  X,
  UserCheck,
  UserX,
  ShieldCheck,
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import GlassPanel from '../components/dashboard/GlassPanel'
import { MeetingWhiteboard } from '../components/whiteboard/MeetingWhiteboard'
import websocketService from '../services/websocketService'
import meetingService from '../services/meetingService'
import type { Meeting, MeetingParticipant, MeetingSignal } from '../types'

interface PendingAccessRequest {
  userId: number
  userName: string
  timestamp: string
}

export default function MeetingRoom() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // LiveKit Connection State
  const [token, setToken] = useState<string>('')
  const [livekitUrl, setLivekitUrl] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<boolean>(false)

  // Meeting Metadata & Host Detection
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [participants, setParticipants] = useState<MeetingParticipant[]>([])

  // Whiteboard State
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState<boolean>(false)
  const [allowedUserIds, setAllowedUserIds] = useState<number[]>([])
  const [allowAllParticipants, setAllowAllParticipants] = useState<boolean>(false)
  const [pendingRequests, setPendingRequests] = useState<PendingAccessRequest[]>([])
  const [layoutMode, setLayoutMode] = useState<'split' | 'theater' | 'video'>('split')
  const [showRequestOpenModal, setShowRequestOpenModal] = useState<boolean>(false)
  const [requestOpenSent, setRequestOpenSent] = useState<boolean>(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false)
  const [notificationToast, setNotificationToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null)

  // Check if current user is Host
  const isHost = Boolean(
    meeting?.host?.id === user?.id ||
    meeting?.host?.email === user?.email ||
    (!meeting && user) // default fallback for instant creator
  )

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setNotificationToast({ message, type })
    setTimeout(() => {
      setNotificationToast(null)
    }, 4000)
  }, [])

  // 1. Fetch LiveKit Token and Meeting Info
  useEffect(() => {
    if (!roomCode) return
    fetchLiveKitToken()
    loadMeetingDetails()
  }, [roomCode])

  async function fetchLiveKitToken() {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<{ token: string; url: string }>('/livekit/token', {
        params: { room: roomCode },
      })
      setToken(res.data.token)
      setLivekitUrl(res.data.url)
    } catch (err: any) {
      console.error('Failed to fetch LiveKit token:', err)
      setError(err?.response?.data?.message || 'Could not connect to LiveKit meeting server.')
    } finally {
      setLoading(false)
    }
  }

  async function loadMeetingDetails() {
    if (!roomCode) return
    try {
      const data = await meetingService.getMeeting(roomCode)
      setMeeting(data)
      if (data.participants) {
        setParticipants(data.participants)
      }
    } catch (err) {
      console.warn('Meeting room not found in backend DB (instant room code)', err)
    }
  }

  // 2. Real-Time STOMP Meeting Signaling (Whiteboard Open/Close, Access Requests, Approvals)
  useEffect(() => {
    if (!roomCode) return

    const unsubscribe = websocketService.subscribeToMeeting(roomCode, (signal: MeetingSignal) => {
      if (!signal) return

      switch (signal.type) {
        case 'WHITEBOARD_OPEN':
          setIsWhiteboardOpen(true)
          if (signal.allowedUserIds) {
            setAllowedUserIds(signal.allowedUserIds)
          }
          showToast(`🎨 ${signal.senderName || 'Host'} opened the Collaborative Whiteboard!`, 'info')
          break

        case 'WHITEBOARD_CLOSE':
          setIsWhiteboardOpen(false)
          showToast('Whiteboard closed by Host', 'warning')
          break

        case 'WHITEBOARD_REQUEST_ACCESS':
          if (isHost && signal.senderId && signal.senderId !== user?.id) {
            setPendingRequests((prev) => {
              if (prev.some((r) => r.userId === signal.senderId)) return prev
              return [
                ...prev,
                {
                  userId: signal.senderId,
                  userName: signal.senderName || 'Participant',
                  timestamp: signal.timestamp || new Date().toISOString(),
                },
              ]
            })
            showToast(`✋ ${signal.senderName || 'A participant'} requested Whiteboard draw access`, 'info')
          }
          break

        case 'WHITEBOARD_GRANT_ACCESS':
          if (signal.targetUserId) {
            setAllowedUserIds((prev) => Array.from(new Set([...prev, signal.targetUserId!])))
            setPendingRequests((prev) => prev.filter((r) => r.userId !== signal.targetUserId))

            if (signal.targetUserId === user?.id) {
              showToast('🎉 You have been granted Whiteboard Draw Access by the Host!', 'success')
            }
          }
          break

        case 'WHITEBOARD_REVOKE_ACCESS':
          if (signal.targetUserId) {
            setAllowedUserIds((prev) => prev.filter((id) => id !== signal.targetUserId))
            if (signal.targetUserId === user?.id) {
              showToast('Your Whiteboard draw access was set to View-Only by the Host', 'warning')
            }
          }
          break

        case 'WHITEBOARD_DENY_ACCESS':
          if (signal.targetUserId) {
            setPendingRequests((prev) => prev.filter((r) => r.userId !== signal.targetUserId))
            if (signal.targetUserId === user?.id) {
              showToast('Host declined your Whiteboard draw request', 'warning')
            }
          }
          break

        case 'WHITEBOARD_SYNC':
          if (signal.isWhiteboardOpen !== undefined) {
            setIsWhiteboardOpen(signal.isWhiteboardOpen)
          }
          if (signal.allowedUserIds) {
            setAllowedUserIds(signal.allowedUserIds)
          }
          break

        case 'JOIN':
          if (signal.senderId && signal.senderName) {
            setParticipants((prev) => {
              if (prev.some((p) => p.user.id === signal.senderId)) return prev
              return [
                ...prev,
                {
                  id: Date.now(),
                  user: {
                    id: signal.senderId,
                    name: signal.senderName,
                    email: '',
                  },
                  role: 'PARTICIPANT',
                  joinedAt: new Date().toISOString(),
                },
              ]
            })

            // If Host, broadcast current whiteboard state to newcomer
            if (isHost && isWhiteboardOpen) {
              websocketService.sendMeetingSignal({
                type: 'WHITEBOARD_SYNC',
                roomCode,
                senderId: user?.id || 0,
                senderName: user?.name || 'Host',
                isWhiteboardOpen: true,
                allowedUserIds,
              })
            }
          }
          break

        case 'LEAVE':
          if (signal.senderId) {
            setParticipants((prev) => prev.filter((p) => p.user.id !== signal.senderId))
            setPendingRequests((prev) => prev.filter((r) => r.userId !== signal.senderId))
          }
          break

        default:
          break
      }
    })

    // Broadcast JOIN signal
    if (user) {
      websocketService.sendMeetingSignal({
        type: 'JOIN',
        roomCode,
        senderId: user.id,
        senderName: user.name,
      })
    }

    return () => {
      if (unsubscribe) unsubscribe()
      if (user) {
        websocketService.sendMeetingSignal({
          type: 'LEAVE',
          roomCode,
          senderId: user.id,
          senderName: user.name,
        })
      }
    }
  }, [roomCode, user, isHost, isWhiteboardOpen, allowedUserIds, showToast])

  // ===== HOST ACTIONS =====

  const handleToggleWhiteboard = () => {
    if (!roomCode || !user) return

    if (isHost) {
      const nextState = !isWhiteboardOpen
      setIsWhiteboardOpen(nextState)

      websocketService.sendMeetingSignal({
        type: nextState ? 'WHITEBOARD_OPEN' : 'WHITEBOARD_CLOSE',
        roomCode,
        senderId: user.id,
        senderName: user.name,
        allowedUserIds,
        isWhiteboardOpen: nextState,
      })

      showToast(
        nextState
          ? 'Whiteboard opened for all meeting participants!'
          : 'Whiteboard closed for all participants',
        nextState ? 'success' : 'info'
      )
    } else {
      // Participant clicking Whiteboard
      if (isWhiteboardOpen) {
        // Toggle view focus
        setLayoutMode((prev) => (prev === 'theater' ? 'split' : 'theater'))
      } else {
        // Prompt host to open
        setShowRequestOpenModal(true)
      }
    }
  }

  const handleGrantAccess = (targetUserId: number) => {
    if (!roomCode || !user || !isHost) return
    const updated = Array.from(new Set([...allowedUserIds, targetUserId]))
    setAllowedUserIds(updated)
    setPendingRequests((prev) => prev.filter((r) => r.userId !== targetUserId))

    websocketService.sendMeetingSignal({
      type: 'WHITEBOARD_GRANT_ACCESS',
      roomCode,
      senderId: user.id,
      senderName: user.name,
      targetUserId,
      allowedUserIds: updated,
    })

    const targetUser = participants.find((p) => p.user.id === targetUserId)
    showToast(`Granted Draw Access to ${targetUser?.user.name || 'Participant'}`, 'success')
  }

  const handleRevokeAccess = (targetUserId: number) => {
    if (!roomCode || !user || !isHost) return
    const updated = allowedUserIds.filter((id) => id !== targetUserId)
    setAllowedUserIds(updated)

    websocketService.sendMeetingSignal({
      type: 'WHITEBOARD_REVOKE_ACCESS',
      roomCode,
      senderId: user.id,
      senderName: user.name,
      targetUserId,
      allowedUserIds: updated,
    })

    const targetUser = participants.find((p) => p.user.id === targetUserId)
    showToast(`Revoked Draw Access for ${targetUser?.user.name || 'Participant'}`, 'info')
  }

  const handleToggleAllowAll = (allowed: boolean) => {
    if (!roomCode || !user || !isHost) return
    setAllowAllParticipants(allowed)

    websocketService.sendMeetingSignal({
      type: 'WHITEBOARD_SYNC',
      roomCode,
      senderId: user.id,
      senderName: user.name,
      isWhiteboardOpen,
      allowedUserIds,
    })

    showToast(
      allowed
        ? 'All participants are now allowed to draw!'
        : 'Whiteboard locked to Host & approved participants only',
      'info'
    )
  }

  const handleApproveRequest = (targetUserId: number) => {
    handleGrantAccess(targetUserId)
  }

  const handleDenyRequest = (targetUserId: number) => {
    if (!roomCode || !user || !isHost) return
    setPendingRequests((prev) => prev.filter((r) => r.userId !== targetUserId))

    websocketService.sendMeetingSignal({
      type: 'WHITEBOARD_DENY_ACCESS',
      roomCode,
      senderId: user.id,
      senderName: user.name,
      targetUserId,
    })
  }

  // ===== PARTICIPANT ACTIONS =====

  const handleRequestDrawAccess = () => {
    if (!roomCode || !user) return

    websocketService.sendMeetingSignal({
      type: 'WHITEBOARD_REQUEST_ACCESS',
      roomCode,
      senderId: user.id,
      senderName: user.name,
    })

    showToast('Draw access request sent to the meeting host!', 'info')
  }

  const handleRequestHostToOpenWhiteboard = () => {
    if (!roomCode || !user) return
    setRequestOpenSent(true)

    websocketService.sendMeetingSignal({
      type: 'WHITEBOARD_REQUEST_ACCESS',
      roomCode,
      senderId: user.id,
      senderName: user.name,
    })

    showToast('Sent request to Host to open the Whiteboard', 'info')
    setTimeout(() => {
      setShowRequestOpenModal(false)
      setRequestOpenSent(false)
    }, 1800)
  }

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(window.location.href)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleDisconnect = () => {
    navigate('/meetings')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] w-full space-y-2.5 overflow-hidden">
      {/* ===== FLOATING NOTIFICATION TOAST ===== */}
      <AnimatePresence>
        {notificationToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border text-xs font-semibold flex items-center gap-2 max-w-sm ${
              notificationToast.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : notificationToast.type === 'warning'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-violet-500/20 text-violet-300 border-violet-500/30'
            }`}
          >
            <Bell size={14} className="animate-pulse flex-shrink-0" />
            <span>{notificationToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TOP MEETING HEADER BAR ===== */}
      <GlassPanel className="p-2.5 md:p-3.5 border border-white/[0.08] shadow-glass flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-400/30 flex items-center justify-center text-cyan-300 shadow-glow">
            <Video size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-display font-bold text-silver">
                {meeting?.title || 'NOVA Secure Meeting'}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                LiveKit
              </span>
              {isHost && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Host
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted flex items-center gap-1.5 font-mono">
              <span>Room: {roomCode}</span>
              <button
                onClick={handleCopyCode}
                className="hover:text-cyan-300 transition-colors p-0.5"
                title="Copy room link"
              >
                {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </p>
          </div>
        </div>

        {/* Center / Right Collaborative Control Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* WHITEBOARD MAIN BUTTON */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleToggleWhiteboard}
            className={`h-9 px-3.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all relative ${
              isWhiteboardOpen
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-glow border border-violet-400/50'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-silver border border-white/[0.08]'
            }`}
          >
            <Palette size={15} className={isWhiteboardOpen ? 'text-cyan-300 animate-pulse' : 'text-violet-400'} />
            <span>{isWhiteboardOpen ? 'Whiteboard Active' : 'Open Whiteboard'}</span>

            {/* Host Pending Request Badge Count */}
            {isHost && pendingRequests.length > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-bounce shadow-md">
                {pendingRequests.length}
              </span>
            )}
          </motion.button>

          {/* Whiteboard Layout Selector (Visible when Whiteboard is open) */}
          {isWhiteboardOpen && (
            <div className="hidden sm:flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-0.5">
              <button
                onClick={() => setLayoutMode('split')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  layoutMode === 'split'
                    ? 'bg-violet-600/60 text-white shadow-sm'
                    : 'text-muted hover:text-silver'
                }`}
                title="Side by Side Split View"
              >
                <Columns size={13} />
                <span>Split</span>
              </button>
              <button
                onClick={() => setLayoutMode('theater')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  layoutMode === 'theater'
                    ? 'bg-violet-600/60 text-white shadow-sm'
                    : 'text-muted hover:text-silver'
                }`}
                title="Theater Canvas View"
              >
                <Maximize2 size={13} />
                <span>Canvas</span>
              </button>
            </div>
          )}

          {/* Host Permissions Manager Button */}
          {isHost && isWhiteboardOpen && (
            <button
              onClick={() => setShowPermissionsModal(true)}
              className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-silver font-medium flex items-center gap-1.5 transition-all"
              title="Manage participant drawing access"
            >
              <SlidersHorizontal size={14} className="text-violet-400" />
              <span className="hidden md:inline">Permissions</span>
            </button>
          )}

          {/* Copy Invite Link */}
          <button
            onClick={handleCopyCode}
            className="h-9 flex items-center gap-1.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-silver font-medium transition-all"
          >
            {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copiedCode ? 'Copied' : 'Invite'}</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={handleDisconnect}
            className="h-9 flex items-center gap-1.5 px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-rose-300 transition-all shadow-sm"
          >
            <PhoneOff size={14} />
            <span>Leave</span>
          </button>
        </div>
      </GlassPanel>

      {/* ===== MAIN COLLABORATION STAGE & VIDEO CONFERENCE AREA ===== */}
      <div className="flex-1 w-full overflow-hidden relative">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-6 glass-panel border border-white/[0.08]">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 animate-pulse shadow-glow">
              <Sparkles size={24} />
            </div>
            <h3 className="text-base font-semibold text-silver">
              Connecting to LiveKit Secure Meeting...
            </h3>
            <p className="text-xs text-muted max-w-sm">
              Establishing encrypted WebRTC media mesh and real-time collaboration canvas.
            </p>
          </div>
        ) : error ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-6 glass-panel border border-rose-500/30">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <Shield size={24} />
            </div>
            <h3 className="text-base font-semibold text-silver">Meeting Connection Error</h3>
            <p className="text-xs text-rose-300 max-w-md">{error}</p>
            <button
              onClick={fetchLiveKitToken}
              className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow"
            >
              Retry Connection
            </button>
          </div>
        ) : token && livekitUrl ? (
          <div className="h-full w-full">
            {/* When Whiteboard is NOT open: Full Video Conference */}
            {!isWhiteboardOpen ? (
              <div className="h-full w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-void-950/80 backdrop-blur-md relative livekit-container">
                <LiveKitRoom
                  video={true}
                  audio={true}
                  token={token}
                  serverUrl={livekitUrl}
                  data-lk-theme="default"
                  onDisconnected={handleDisconnect}
                  style={{ height: '100%', width: '100%' }}
                >
                  <VideoConference />
                </LiveKitRoom>
              </div>
            ) : layoutMode === 'split' ? (
              /* SPLIT VIEW: Whiteboard on Left (70%), Video Conference on Right (30%) */
              <div className="h-full w-full grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">
                <div className="lg:col-span-8 h-full rounded-2xl overflow-hidden shadow-2xl">
                  <MeetingWhiteboard
                    roomCode={roomCode || ''}
                    isHost={isHost}
                    meetingTitle={meeting?.title || 'Meeting Whiteboard'}
                    participants={participants}
                    allowedUserIds={allowedUserIds}
                    allowAllParticipants={allowAllParticipants}
                    onGrantAccess={handleGrantAccess}
                    onRevokeAccess={handleRevokeAccess}
                    onToggleAllowAll={handleToggleAllowAll}
                    onRequestAccess={handleRequestDrawAccess}
                    onCloseWhiteboard={() => setIsWhiteboardOpen(false)}
                    pendingRequests={pendingRequests}
                    onApproveRequest={handleApproveRequest}
                    onDenyRequest={handleDenyRequest}
                    isFullscreen={false}
                    onToggleFullscreen={() => setLayoutMode('theater')}
                  />
                </div>

                <div className="lg:col-span-4 h-full rounded-2xl overflow-hidden border border-white/[0.08] bg-void-950/90 backdrop-blur-md relative livekit-container shadow-2xl">
                  <LiveKitRoom
                    video={true}
                    audio={true}
                    token={token}
                    serverUrl={livekitUrl}
                    data-lk-theme="default"
                    onDisconnected={handleDisconnect}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <VideoConference />
                  </LiveKitRoom>
                </div>
              </div>
            ) : (
              /* THEATER VIEW: Full-stage Whiteboard with minimizable Floating LiveKit strip */
              <div className="h-full w-full flex flex-col gap-2 overflow-hidden relative">
                <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl">
                  <MeetingWhiteboard
                    roomCode={roomCode || ''}
                    isHost={isHost}
                    meetingTitle={meeting?.title || 'Meeting Whiteboard'}
                    participants={participants}
                    allowedUserIds={allowedUserIds}
                    allowAllParticipants={allowAllParticipants}
                    onGrantAccess={handleGrantAccess}
                    onRevokeAccess={handleRevokeAccess}
                    onToggleAllowAll={handleToggleAllowAll}
                    onRequestAccess={handleRequestDrawAccess}
                    onCloseWhiteboard={() => setIsWhiteboardOpen(false)}
                    pendingRequests={pendingRequests}
                    onApproveRequest={handleApproveRequest}
                    onDenyRequest={handleDenyRequest}
                    isFullscreen={true}
                    onToggleFullscreen={() => setLayoutMode('split')}
                  />
                </div>

                {/* Floating Bottom Mini Video Bar */}
                <div className="h-28 w-full max-w-xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-void-950/90 backdrop-blur-md shadow-2xl relative livekit-container">
                  <LiveKitRoom
                    video={true}
                    audio={true}
                    token={token}
                    serverUrl={livekitUrl}
                    data-lk-theme="default"
                    onDisconnected={handleDisconnect}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <VideoConference />
                  </LiveKitRoom>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ===== PARTICIPANT REQUEST HOST TO OPEN WHITEBOARD MODAL ===== */}
      <AnimatePresence>
        {showRequestOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-sm p-6 border border-violet-500/40 shadow-glow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-violet-400" />
                  <h3 className="text-sm font-bold text-silver">Collaborative Whiteboard</h3>
                </div>
                <button
                  onClick={() => setShowRequestOpenModal(false)}
                  className="text-muted hover:text-silver"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-muted leading-relaxed mb-4">
                The Whiteboard is currently closed. As a participant, you can ask the Host to open
                the interactive Whiteboard for everyone in this call.
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setShowRequestOpenModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-muted hover:text-silver"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestHostToOpenWhiteboard}
                  disabled={requestOpenSent}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Palette size={13} />
                  <span>{requestOpenSent ? 'Request Sent!' : 'Ask Host to Open'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== HOST PERMISSIONS MODAL ===== */}
      <AnimatePresence>
        {showPermissionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md p-6 border border-violet-500/40 shadow-glow"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-violet-400" />
                  <h3 className="text-base font-bold text-silver">Whiteboard Access Control</h3>
                </div>
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="text-muted hover:text-silver"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Toggle Allow Everyone */}
              <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/[0.06] mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-silver">Allow Everyone to Draw</p>
                  <p className="text-[11px] text-muted">Any participant can pick up a pen and draw</p>
                </div>
                <button
                  onClick={() => handleToggleAllowAll(!allowAllParticipants)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    allowAllParticipants ? 'bg-emerald-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white transition-transform ${
                      allowAllParticipants ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Participant Access List */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-lavender">
                  Active Meeting Participants ({participants.length})
                </p>

                {participants.length === 0 ? (
                  <p className="text-xs text-muted italic py-3 text-center">No other participants currently in room</p>
                ) : (
                  participants.map((p) => {
                    const isUserHost = p.role === 'HOST' || p.user.id === user?.id
                    const isAllowed = allowAllParticipants || allowedUserIds.includes(p.user.id)
                    const isPending = pendingRequests.some((r) => r.userId === p.user.id)

                    return (
                      <div
                        key={p.user.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06]"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-silver truncate">{p.user.name}</p>
                          <span className="text-[10px] text-muted flex items-center gap-1">
                            {isUserHost ? (
                              <span className="text-violet-400">Host (Full Access)</span>
                            ) : isAllowed ? (
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <Unlock size={10} /> Draw Allowed
                              </span>
                            ) : isPending ? (
                              <span className="text-amber-400 animate-pulse">Requesting Draw Access...</span>
                            ) : (
                              <span className="text-muted flex items-center gap-0.5">
                                <Lock size={10} /> View Only
                              </span>
                            )}
                          </span>
                        </div>

                        {!isUserHost && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isAllowed ? (
                              <button
                                onClick={() => handleRevokeAccess(p.user.id)}
                                className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1 border border-rose-500/30 transition-colors"
                              >
                                <UserX size={12} />
                                <span>Revoke</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGrantAccess(p.user.id)}
                                className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1 border border-emerald-500/30 transition-colors"
                              >
                                <UserCheck size={12} />
                                <span>Allow Access</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-white/[0.08] flex justify-end">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-glow"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

