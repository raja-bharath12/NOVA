import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Hand,
  PhoneOff,
  Send,
  X,
  User as UserIcon,
  Sparkles,
  Copy,
  Check,
  Palette,
  LayoutGrid,
  Shield,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { meetingService } from '../services/meetingService'
import { webrtcService } from '../services/webrtcService'
import { websocketService } from '../services/websocketService'
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas'
import type { Meeting, MeetingSignal } from '../types'

interface RemotePeer {
  id: number
  name: string
  stream: MediaStream
  isScreenSharing?: boolean
  isHandRaised?: boolean
}

export default function MeetingRoom() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)

  // Media & Controls State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [meetingMode, setMeetingMode] = useState<'AUTO' | 'GRID' | 'WHITEBOARD'>('AUTO')

  // Remote Peers State: peerId -> RemotePeer
  const [remotePeers, setRemotePeers] = useState<Map<number, RemotePeer>>(new Map())

  // Side Drawer State: 'chat' | 'participants' | null
  const [sideDrawer, setSideDrawer] = useState<'chat' | 'participants' | null>(null)
  const [chatMessages, setChatMessages] = useState<MeetingSignal[]>([])
  const [chatInput, setChatInput] = useState('')

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roomCode || !user) return

    initMeetingRoom()

    return () => {
      cleanupMeeting()
    }
  }, [roomCode, user])

  // Bind local camera stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Bind local screen share stream
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream
    }
  }, [screenStream])

  // Scroll meeting chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, sideDrawer])

  async function initMeetingRoom() {
    try {
      setLoading(true)
      const data = await meetingService.joinMeeting(roomCode!)
      setMeeting(data)

      // Initialize local media
      const media = await webrtcService.getLocalMedia(true, true)
      setLocalStream(media)

      // Setup WebRTC peer stream callback
      webrtcService.setupMeetingRoom(
        (peerId, stream) => {
          setRemotePeers((prev) => {
            const next = new Map(prev)
            const existing = next.get(peerId)
            next.set(peerId, {
              id: peerId,
              name: existing?.name || `Participant ${peerId}`,
              stream,
            })
            return next
          })
        },
        (peerId) => {
          setRemotePeers((prev) => {
            const next = new Map(prev)
            next.delete(peerId)
            return next
          })
        }
      )

      // Subscribe to meeting room signals
      const unsub = websocketService.subscribeToMeeting(
        roomCode!,
        (signal) => {
          handleIncomingMeetingSignal(signal)
        },
        (chatSignal) => {
          setChatMessages((prev) => [...prev, chatSignal])
        }
      )

      // Announce JOIN to mesh peers
      websocketService.sendMeetingSignal({
        type: 'JOIN',
        roomCode: roomCode!,
        senderId: user!.id,
        senderName: user!.name,
      })
    } catch (err) {
      console.error('Failed to initialize meeting room', err)
      alert('Could not join meeting room. It may be invalid or ended.')
      navigate('/meetings')
    } finally {
      setLoading(false)
    }
  }

  async function handleIncomingMeetingSignal(signal: MeetingSignal) {
    if (!user || signal.senderId === user.id) return

    if (signal.type === 'HAND_RAISE') {
      setRemotePeers((prev) => {
        const next = new Map(prev)
        const p = next.get(signal.senderId)
        if (p) {
          next.set(signal.senderId, { ...p, isHandRaised: signal.isHandRaised })
        }
        return next
      })
    } else if (signal.type === 'SCREEN_SHARE_START' || signal.type === 'SCREEN_SHARE_STOP') {
      setRemotePeers((prev) => {
        const next = new Map(prev)
        const p = next.get(signal.senderId)
        if (p) {
          next.set(signal.senderId, { ...p, isScreenSharing: signal.type === 'SCREEN_SHARE_START' })
        }
        return next
      })
    } else {
      await webrtcService.handleMeetingMeshSignal(signal, user.id, user.name, roomCode!)
    }
  }

  async function handleToggleScreenShare() {
    if (isScreenSharing) {
      webrtcService.stopScreenShare()
      setScreenStream(null)
      setIsScreenSharing(false)
      websocketService.sendMeetingSignal({
        type: 'SCREEN_SHARE_STOP',
        roomCode: roomCode!,
        senderId: user!.id,
        senderName: user!.name,
      })
    } else {
      try {
        const screen = await webrtcService.getScreenMedia()
        setScreenStream(screen)
        setIsScreenSharing(true)

        // When track ends via browser UI
        screen.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false)
          setScreenStream(null)
          websocketService.sendMeetingSignal({
            type: 'SCREEN_SHARE_STOP',
            roomCode: roomCode!,
            senderId: user!.id,
            senderName: user!.name,
          })
        }

        websocketService.sendMeetingSignal({
          type: 'SCREEN_SHARE_START',
          roomCode: roomCode!,
          senderId: user!.id,
          senderName: user!.name,
        })
      } catch (err) {
        console.warn('Screen share cancelled', err)
      }
    }
  }

  function handleToggleMic() {
    const nextState = !isMicMuted
    setIsMicMuted(nextState)
    webrtcService.toggleMicrophone(!nextState)
  }

  function handleToggleCam() {
    const nextState = !isCamOff
    setIsCamOff(nextState)
    webrtcService.toggleCamera(!nextState)
  }

  function handleToggleHand() {
    const nextState = !isHandRaised
    setIsHandRaised(nextState)
    websocketService.sendMeetingSignal({
      type: 'HAND_RAISE',
      roomCode: roomCode!,
      senderId: user!.id,
      senderName: user!.name,
      isHandRaised: nextState,
    })
  }

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || !user) return

    websocketService.sendMeetingChat({
      type: 'CHAT_MESSAGE',
      roomCode: roomCode!,
      senderId: user.id,
      senderName: user.name,
      chatContent: chatInput.trim(),
    })

    setChatInput('')
  }

  function copyRoomCode() {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  function cleanupMeeting() {
    if (user && roomCode) {
      webrtcService.leaveMeetingRoom(user.id, user.name, roomCode)
      meetingService.leaveMeeting(roomCode).catch(() => {})
    }
  }

  function handleLeave() {
    cleanupMeeting()
    navigate('/meetings')
  }

  const peerList = Array.from(remotePeers.values())

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-void-950 text-silver select-none overflow-hidden">
      {/* Top Meeting Header Bar */}
      <div className="h-14 px-6 border-b border-white/[0.06] bg-void-950/80 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulseGlow" />
          <h2 className="text-sm font-semibold font-display text-silver">{meeting?.title || 'Meeting Room'}</h2>
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-mono text-lavender border border-white/[0.06] transition-all ml-2"
            title="Copy Room Code"
          >
            <span>{roomCode}</span>
            {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setMeetingMode('GRID')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                meetingMode !== 'WHITEBOARD'
                  ? 'bg-violet-600 text-silver shadow-glow'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Video Grid</span>
            </button>
            <button
              onClick={() => setMeetingMode('WHITEBOARD')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                meetingMode === 'WHITEBOARD'
                  ? 'bg-violet-600 text-silver shadow-glow'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <Palette size={13} />
              <span>Whiteboard</span>
            </button>
          </div>

          <span className="label-tracked text-[10px] text-cyan-400 flex items-center gap-1">
            <Shield size={12} />
            <span>P2P Encrypted</span>
          </span>
        </div>
      </div>

      {/* Main Stage & Grid */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-3 md:p-5 flex flex-col items-center justify-center overflow-hidden">
          {/* If Whiteboard Mode Active */}
          {meetingMode === 'WHITEBOARD' ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-full flex-1 relative rounded-2xl overflow-hidden shadow-2xl">
                <WhiteboardCanvas
                  meetingRoomCode={roomCode}
                  title={`Meeting ${roomCode} Live Whiteboard`}
                />
              </div>

              {/* Mini participant floating strip */}
              <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
                <div className="h-14 w-20 rounded-xl overflow-hidden glass-panel border border-white/[0.08] relative flex-shrink-0">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0.5 left-1 text-[8px] text-silver bg-black/60 px-1 rounded">
                    You
                  </span>
                </div>
                {peerList.map((peer) => (
                  <RemoteVideoTile key={peer.id} peer={peer} mini />
                ))}
              </div>
            </div>
          ) : isScreenSharing && screenStream ? (
            /* If Screen Share Active: Show Primary Screen Stage */
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="relative w-full h-full max-h-[72vh] rounded-2xl overflow-hidden glass-panel border border-cyan-400/40 shadow-glow-cyan">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute top-3 left-3 bg-void-950/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs text-cyan-400 border border-cyan-400/30 flex items-center gap-2">
                  <Monitor size={14} />
                  <span>You are sharing your screen</span>
                </div>
              </div>

              {/* Mini participant strip below screen share */}
              <div className="flex items-center gap-3 mt-3 overflow-x-auto max-w-full py-1">
                {/* Local Camera Tile */}
                <div className="h-24 w-36 rounded-xl overflow-hidden glass-panel border border-white/[0.08] relative flex-shrink-0">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-2 text-[10px] text-silver bg-black/60 px-1.5 py-0.5 rounded">
                    You
                  </span>
                </div>

                {/* Remote Peers */}
                {peerList.map((peer) => (
                  <RemoteVideoTile key={peer.id} peer={peer} mini />
                ))}
              </div>
            </div>
          ) : (
            // Standard Video Grid
            <div
              className={`grid w-full h-full max-h-[75vh] gap-4 ${
                peerList.length === 0
                  ? 'grid-cols-1 max-w-2xl'
                  : peerList.length === 1
                  ? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
                  : 'grid-cols-2 md:grid-cols-3 max-w-6xl'
              }`}
            >
              {/* Local Video Card */}
              <div className="relative rounded-2xl overflow-hidden glass-panel border border-white/[0.08] flex items-center justify-center bg-void-900/60 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCamOff ? 'hidden' : ''}`}
                />
                {isCamOff && (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-violet-600/40 to-cyan-500/30 border border-violet-400/30 flex items-center justify-center mb-2 shadow-glow">
                      <UserIcon size={36} className="text-silver" />
                    </div>
                    <p className="text-xs font-semibold text-silver">{user?.name} (You)</p>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-void-950/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs text-silver border border-white/[0.06]">
                  <span>{user?.name} (You)</span>
                  {isMicMuted && <MicOff size={12} className="text-rose-400" />}
                </div>

                {isHandRaised && (
                  <div className="absolute top-3 right-3 bg-amber-500 text-void-950 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-bounce">
                    <Hand size={14} />
                    <span>Hand Raised</span>
                  </div>
                )}
              </div>

              {/* Remote Peer Video Cards */}
              {peerList.map((peer) => (
                <RemoteVideoTile key={peer.id} peer={peer} />
              ))}
            </div>
          )}
        </div>

        {/* ===== SIDE DRAWER: In-Meeting Chat & Participants ===== */}
        <AnimatePresence>
          {sideDrawer && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="h-full border-l border-white/[0.06] bg-void-900/90 backdrop-blur-xl flex flex-col overflow-hidden z-20"
            >
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSideDrawer('chat')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      sideDrawer === 'chat'
                        ? 'bg-violet-600/40 text-silver border border-violet-400/40 shadow-glow'
                        : 'text-muted hover:text-silver'
                    }`}
                  >
                    Meeting Chat
                  </button>
                  <button
                    onClick={() => setSideDrawer('participants')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      sideDrawer === 'participants'
                        ? 'bg-violet-600/40 text-silver border border-violet-400/40 shadow-glow'
                        : 'text-muted hover:text-silver'
                    }`}
                  >
                    Attendees ({peerList.length + 1})
                  </button>
                </div>
                <button onClick={() => setSideDrawer(null)} className="text-muted hover:text-lavender">
                  <X size={16} />
                </button>
              </div>

              {sideDrawer === 'chat' ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-muted py-12">
                        No messages yet. Send a note to the meeting!
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.04]">
                          <div className="flex items-center justify-between mb-1 text-[10px]">
                            <span className="font-semibold text-lavender">{msg.senderName}</span>
                            <span className="text-muted">
                              {new Date(msg.timestamp || '').toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-silver">{msg.chatContent}</p>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="p-3 border-t border-white/[0.06] flex gap-2">
                    <input
                      type="text"
                      placeholder="Message meeting..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2 rounded-xl bg-violet-600 text-silver disabled:opacity-40"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
                  {/* Local User */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
                    <span className="font-medium text-silver">{user?.name} (You)</span>
                    <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
                      {meeting?.host.id === user?.id ? 'Host' : 'Participant'}
                    </span>
                  </div>

                  {/* Remote Peers */}
                  {peerList.map((peer) => (
                    <div key={peer.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02]">
                      <span className="text-silver">{peer.name}</span>
                      {peer.isHandRaised && (
                        <span className="text-amber-400 flex items-center gap-1 text-[10px]">
                          <Hand size={12} /> Raised
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== BOTTOM MEETING TOOLBAR ===== */}
      <div className="h-20 border-t border-white/[0.06] bg-void-950/80 backdrop-blur-xl flex items-center justify-center gap-3 md:gap-4 px-6 z-10 flex-shrink-0">
        <button
          onClick={handleToggleMic}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            isMicMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title={isMicMuted ? 'Unmute' : 'Mute'}
        >
          {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          onClick={handleToggleCam}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            isCamOff
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCamOff ? <VideoOff size={18} /> : <Video size={18} />}
        </button>

        <button
          onClick={handleToggleScreenShare}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            isScreenSharing
              ? 'bg-cyan-500 text-void-950 shadow-glow-cyan font-bold'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>

        <button
          onClick={() => setMeetingMode(meetingMode === 'WHITEBOARD' ? 'GRID' : 'WHITEBOARD')}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            meetingMode === 'WHITEBOARD'
              ? 'bg-purple-600 text-silver shadow-glow font-bold'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title={meetingMode === 'WHITEBOARD' ? 'Close Whiteboard' : 'Open Collaborative Whiteboard'}
        >
          <Palette size={18} />
        </button>

        <button
          onClick={handleToggleHand}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            isHandRaised
              ? 'bg-amber-500 text-void-950 shadow-[0_0_16px_rgba(245,158,11,0.5)]'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <Hand size={18} />
        </button>

        <button
          onClick={() => setSideDrawer(sideDrawer === 'chat' ? null : 'chat')}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            sideDrawer === 'chat'
              ? 'bg-violet-600 text-silver shadow-glow'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title="Meeting Chat"
        >
          <MessageSquare size={18} />
        </button>

        <button
          onClick={() => setSideDrawer(sideDrawer === 'participants' ? null : 'participants')}
          className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
            sideDrawer === 'participants'
              ? 'bg-violet-600 text-silver shadow-glow'
              : 'bg-white/[0.05] text-silver hover:bg-white/[0.1] border border-white/[0.1]'
          }`}
          title="Participants"
        >
          <Users size={18} />
        </button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLeave}
          className="h-12 px-6 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all ml-2"
        >
          <PhoneOff size={16} />
          <span>Leave Room</span>
        </motion.button>
      </div>
    </div>
  )
}

function RemoteVideoTile({ peer, mini }: { peer: RemotePeer; mini?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream
    }
  }, [peer.stream])

  if (mini) {
    return (
      <div className="h-24 w-36 rounded-xl overflow-hidden glass-panel border border-white/[0.08] relative flex-shrink-0">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <span className="absolute bottom-1 left-2 text-[10px] text-silver bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[90px]">
          {peer.name}
        </span>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl overflow-hidden glass-panel border border-white/[0.08] flex items-center justify-center bg-void-900/60 shadow-lg">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-3 left-3 bg-void-950/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs text-silver border border-white/[0.06]">
        <span>{peer.name}</span>
      </div>
      {peer.isHandRaised && (
        <div className="absolute top-3 right-3 bg-amber-500 text-void-950 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-bounce">
          <Hand size={14} />
          <span>Hand Raised</span>
        </div>
      )}
    </div>
  )
}
