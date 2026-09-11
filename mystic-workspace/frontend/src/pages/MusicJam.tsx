import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Radio,
  Users,
  Plus,
  Trash2,
  Share2,
  UploadCloud,
  Music,
  Headphones,
  Sparkles,
  MessageSquare,
  ListMusic,
  Disc3,
  Flame,
  Heart,
  Zap,
  PartyPopper,
  Check,
  Copy,
  ChevronRight,
  ExternalLink,
  Send,
  X,
  Sliders,
  Shield,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { musicService } from '../services/musicService'
import { websocketService } from '../services/websocketService'
import type {
  MusicTrack,
  MusicRoom,
  MusicQueueItem,
  MusicChatMessage,
  MusicSyncAction,
} from '../types'

interface FloatingReaction {
  id: string
  emoji: string
  x: number
}

const REACTION_EMOJIS = ['🔥', '🎧', '💃', '❤️', '⚡', '🚀', '💎', '🎵']

export default function MusicJam() {
  const { roomCode: paramRoomCode } = useParams<{ roomCode?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { showToast } = useToast()

  // Room & Track State
  const [currentRoom, setCurrentRoom] = useState<MusicRoom | null>(null)
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [inRoom, setInRoom] = useState(false)

  // Player State
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)

  // UI Panels State
  const [showQueue, setShowQueue] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddTrackModal, setShowAddTrackModal] = useState(false)

  // Floating Reactions
  const [reactions, setReactions] = useState<FloatingReaction[]>([])

  // In-Room Chat State
  const [chatMessages, setChatMessages] = useState<MusicChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Create Room Form State
  const [newRoomTitle, setNewRoomTitle] = useState('')
  const [selectedInitialTrackId, setSelectedInitialTrackId] = useState<number | null>(null)
  const [isCollaborative, setIsCollaborative] = useState(true)
  const [creatingRoom, setCreatingRoom] = useState(false)

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadArtist, setUploadArtist] = useState('')
  const [uploadAlbum, setUploadAlbum] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Join by code input
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  const isHost = currentRoom?.hostId === user?.id
  const canControl = isHost || currentRoom?.isCollaborative

  // 1. Initial Data Loading
  useEffect(() => {
    loadTracks()
  }, [])

  useEffect(() => {
    if (paramRoomCode) {
      joinOrLoadRoom(paramRoomCode)
    } else {
      setInRoom(false)
      setCurrentRoom(null)
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [paramRoomCode])

  // WebSocket Subscription when inside a room
  useEffect(() => {
    if (!paramRoomCode || !inRoom) return

    const token = localStorage.getItem('mystic_token') || ''
    websocketService.connect(token)

    const cleanCode = paramRoomCode.trim().toLowerCase().replace(/^.*\/music\//, '')
    const unsubscribe = websocketService.subscribeToMusicRoom(
      cleanCode,
      (action) => {
        handleRemoteSyncAction(action)
      },
      (reactionAction) => {
        if (reactionAction.emoji) {
          triggerFloatingReaction(reactionAction.emoji)
        }
      },
      (chatMsg) => {
        setChatMessages((prev) => [...prev, chatMsg])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [paramRoomCode, inRoom])

  async function loadTracks() {
    try {
      const data = await musicService.getTracks()
      setTracks(data)
    } catch (err) {
      console.error('Failed to load tracks', err)
    } finally {
      setLoading(false)
    }
  }

  // 2. Room Management
  async function joinOrLoadRoom(code: string) {
    try {
      setLoading(true)
      const token = localStorage.getItem('mystic_token') || ''
      websocketService.connect(token)

      const cleanCode = code.trim().toLowerCase().replace(/^.*\/music\//, '')
      const roomData = await musicService.joinRoom(cleanCode)
      setCurrentRoom(roomData)
      setInRoom(true)
      loadChatMessages(cleanCode)
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to join Music Jam room', 'warning')
      navigate('/music')
    } finally {
      setLoading(false)
    }
  }

  async function loadChatMessages(code: string) {
    try {
      const msgs = await musicService.getMessages(code)
      setChatMessages(msgs)
    } catch (err) {
      console.error('Failed to load messages', err)
    }
  }

  function handleRemoteSyncAction(action: MusicSyncAction) {
    if (!audioRef.current) return

    // Avoid reacting to own actions if already applied
    if (action.senderId === user?.id && action.type !== 'QUEUE_CHANGE' && action.type !== 'TRACK_CHANGE' && action.type !== 'NEXT') return

    // Compute expected target position with timestamp latency compensation
    let targetPos = action.position ?? audioRef.current.currentTime
    const rate = action.playbackRate || 1.0
    if (action.timestamp && (action.type === 'PLAY' || action.type === 'SYNC' || action.isPlaying)) {
      const elapsedSec = (Date.now() - action.timestamp) / 1000.0
      if (elapsedSec > 0 && elapsedSec < 60) {
        targetPos += elapsedSec * rate
      }
    }

    const currentDrift = targetPos - audioRef.current.currentTime

    switch (action.type) {
      case 'PLAY':
        // Tiered Audio Drift:
        // > 400ms: Seek jump
        // 100ms - 400ms: Smooth rate nudge (no audio glitch)
        // < 100ms: Keep smooth
        if (Math.abs(currentDrift) > 0.4) {
          audioRef.current.currentTime = Math.max(0, targetPos)
          audioRef.current.playbackRate = rate
        } else if (Math.abs(currentDrift) > 0.1) {
          const nudge = currentDrift > 0 ? Math.min(rate * 1.05, 1.5) : Math.max(rate * 0.95, 0.7)
          audioRef.current.playbackRate = nudge
          setTimeout(() => {
            if (audioRef.current) audioRef.current.playbackRate = rate
          }, 1000)
        } else {
          audioRef.current.playbackRate = rate
        }

        if (audioRef.current.paused) {
          audioRef.current.play().catch((err) => console.warn('Audio play blocked by browser policy:', err))
        }
        setIsPlaying(true)
        break

      case 'PAUSE':
        if (action.position !== undefined) {
          audioRef.current.currentTime = action.position
          setCurrentTime(action.position)
        }
        if (!audioRef.current.paused) {
          audioRef.current.pause()
        }
        setIsPlaying(false)
        break

      case 'SEEK':
      case 'SYNC':
        audioRef.current.currentTime = Math.max(0, targetPos)
        setCurrentTime(targetPos)
        if (action.isPlaying && audioRef.current.paused) {
          audioRef.current.play().catch(() => {})
          setIsPlaying(true)
        } else if (action.isPlaying === false && !audioRef.current.paused) {
          audioRef.current.pause()
          setIsPlaying(false)
        }
        break


      case 'TRACK_CHANGE':
      case 'NEXT':
      case 'QUEUE_CHANGE':
        if (paramRoomCode) {
          const clean = paramRoomCode.trim().toLowerCase().replace(/^.*\/music\//, '')
          musicService.getRoom(clean).then((updated) => {
            setCurrentRoom(updated)
            if (updated.currentTrack) {
              setupMediaSession(updated.currentTrack)
            }
          }).catch(() => {})
        }
        break
    }
  }

  function sendSyncAction(action: Partial<MusicSyncAction>) {
    if (!currentRoom) return
    const clean = currentRoom.roomCode.trim().toLowerCase()
    websocketService.sendMusicAction(clean, {
      ...action,
      roomCode: clean,
      senderId: user?.id,
      senderName: user?.name,
    })
  }


  // 4. Audio Playback Engine
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Media Session API for lock screen controls
  function setupMediaSession(track: MusicTrack) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'NOVA Music Jam',
        artwork: [
          {
            src: track.coverArtUrl || '/logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      })

      navigator.mediaSession.setActionHandler('play', () => handleTogglePlay())
      navigator.mediaSession.setActionHandler('pause', () => handleTogglePlay())
      navigator.mediaSession.setActionHandler('nexttrack', () => handleAdvanceNext())
    }
  }

  function handleTogglePlay() {
    if (!audioRef.current || !currentRoom?.currentTrack) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      sendSyncAction({
        type: 'PAUSE',
        position: audioRef.current.currentTime,
      })
      musicService.updatePlayback(currentRoom.roomCode, audioRef.current.currentTime, false)
    } else {
      audioRef.current.play().catch(() => {})
      setIsPlaying(true)
      sendSyncAction({
        type: 'PLAY',
        position: audioRef.current.currentTime,
      })
      musicService.updatePlayback(currentRoom.roomCode, audioRef.current.currentTime, true)
    }
  }

  function handleSeekChange(e: React.ChangeEvent<HTMLInputElement>) {
    const target = parseFloat(e.target.value)
    setCurrentTime(target)
    if (audioRef.current) {
      audioRef.current.currentTime = target
    }
  }

  function handleSeekEnd() {
    if (audioRef.current && currentRoom) {
      sendSyncAction({
        type: 'SEEK',
        position: audioRef.current.currentTime,
      })
      musicService.updatePlayback(currentRoom.roomCode, audioRef.current.currentTime, isPlaying)
    }
  }

  async function handleAdvanceNext() {
    if (!currentRoom) return
    try {
      const updated = await musicService.advanceNextTrack(currentRoom.roomCode)
      setCurrentRoom(updated)
      sendSyncAction({ type: 'NEXT' })
      if (updated.currentTrack) {
        setupMediaSession(updated.currentTrack)
      }
    } catch (err: any) {
      showToast('Failed to advance track', 'warning')
    }
  }

  async function handleSelectTrackToPlay(trackId: number) {
    if (!currentRoom) return
    try {
      const updated = await musicService.changeTrack(currentRoom.roomCode, trackId)
      setCurrentRoom(updated)
      setShowAddTrackModal(false)
      sendSyncAction({ type: 'TRACK_CHANGE', trackId })
      if (updated.currentTrack) {
        setupMediaSession(updated.currentTrack)
      }
      showToast('Track changed!', 'success')
    } catch (err: any) {
      showToast('Failed to change track', 'warning')
    }
  }

  async function handleAddToQueue(trackId: number) {
    if (!currentRoom) return
    try {
      const updated = await musicService.addToQueue(currentRoom.roomCode, trackId)
      setCurrentRoom(updated)
      setShowAddTrackModal(false)
      sendSyncAction({ type: 'QUEUE_CHANGE' })
      showToast('Added track to queue!', 'success')
    } catch (err: any) {
      showToast('Failed to add to queue', 'warning')
    }
  }

  async function handleRemoveFromQueue(itemId: number) {
    if (!currentRoom) return
    try {
      const updated = await musicService.removeFromQueue(currentRoom.roomCode, itemId)
      setCurrentRoom(updated)
      sendSyncAction({ type: 'QUEUE_CHANGE' })
    } catch (err: any) {
      showToast('Failed to remove from queue', 'warning')
    }
  }

  // 5. Floating Reactions
  function handleSendReaction(emoji: string) {
    triggerFloatingReaction(emoji)
    if (currentRoom) {
      websocketService.sendMusicReaction(currentRoom.roomCode, {
        type: 'REACTION',
        roomCode: currentRoom.roomCode,
        emoji,
        senderName: user?.name,
      })
    }
  }

  function triggerFloatingReaction(emoji: string) {
    const id = Math.random().toString(36).substring(2, 9)
    const randomX = Math.floor(Math.random() * 60) + 20 // 20% to 80% width
    setReactions((prev) => [...prev, { id, emoji, x: randomX }])
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id))
    }, 2500)
  }

  // 6. In-Room Chat Sending
  async function handleSendChatMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || !currentRoom) return

    const content = chatInput.trim()
    setChatInput('')

    if (websocketService.isConnected()) {
      websocketService.sendMusicChat(currentRoom.roomCode, content)
    } else {
      try {
        const msg = await musicService.sendMessage(currentRoom.roomCode, content)
        setChatMessages((prev) => [...prev, msg])
      } catch (err) {
        showToast('Failed to send message', 'warning')
      }
    }
  }

  // 7. Modals: Create Room & Upload Track
  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    try {
      setCreatingRoom(true)
      const room = await musicService.createRoom(
        newRoomTitle.trim() || `${user?.name}'s Music Jam`,
        selectedInitialTrackId || (tracks[0] ? tracks[0].id : undefined),
        isCollaborative
      )
      setShowCreateModal(false)
      navigate(`/music/${room.roomCode}`)
      showToast('Music Jam Room created!', 'success')
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create room', 'warning')
    } finally {
      setCreatingRoom(false)
    }
  }

  async function handleUploadTrack(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) {
      showToast('Please select an audio file', 'warning')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(10)
      const newTrack = await musicService.uploadTrack(
        uploadFile,
        uploadTitle,
        uploadArtist,
        uploadAlbum,
        undefined,
        undefined,
        (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(percent)
          }
        }
      )
      setTracks((prev) => [newTrack, ...prev])
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadArtist('')
      setUploadAlbum('')
      showToast(`Uploaded "${newTrack.title}" successfully!`, 'success')
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to upload audio', 'warning')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  function handleCopyRoomLink() {
    if (!currentRoom) return
    const url = `${window.location.origin}/music/${currentRoom.roomCode}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    showToast('Room link copied to clipboard!', 'info')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function formatTime(seconds: number) {
    if (isNaN(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // ===========================================================================
  // RENDER: LOBBY VIEW (When not in a room)
  // ===========================================================================
  if (!inRoom) {
    return (
      <div className="flex-1 flex flex-col h-full max-h-full overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl glass-panel border border-violet-500/20 bg-gradient-to-br from-violet-950/70 via-void-950 to-cyan-950/50 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-300 text-xs font-semibold">
                <Radio size={14} className="animate-pulse" />
                <span>Synchronized Group Listening</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-gradient tracking-tight">
                NOVA Music Jam
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-xl leading-relaxed">
                Stream cloud audio tracks together in perfect sub-second sync. Create collaborative listening rooms,
                DJ with your team, share beats, and react in real-time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center gap-2"
              >
                <Plus size={16} />
                <span>Start Music Jam</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-silver border border-white/[0.1] font-semibold text-xs sm:text-sm transition-all flex items-center gap-2"
              >
                <UploadCloud size={16} className="text-cyan-400" />
                <span>Upload Audio</span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Join by Code Bar */}
        <div className="glass-panel p-4 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Headphones size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-silver">Have an Invite Code?</h3>
              <p className="text-xs text-muted">Enter a Room Code like "jam-abc123" or paste an invite link</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="e.g. jam-88219x"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              className="w-full sm:w-64 bg-void-950/80 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-silver font-mono placeholder:text-muted focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => {
                if (joinCodeInput.trim()) {
                  navigate(`/music/${joinCodeInput.trim()}`)
                }
              }}
              disabled={!joinCodeInput.trim()}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0"
            >
              <span>Join</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Cloud Track Library */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListMusic size={18} className="text-violet-400" />
              <h2 className="text-base sm:text-lg font-bold font-display text-silver">
                Cloud Music Library ({tracks.length})
              </h2>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1 font-medium"
            >
              <Plus size={14} />
              <span>Upload Track</span>
            </button>
          </div>

          {tracks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl glass-panel border border-white/[0.06] space-y-3">
              <Disc3 size={40} className="mx-auto text-muted/40 animate-spin-slow" />
              <div className="text-sm font-semibold text-silver">No tracks in your library yet</div>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Upload your favorite MP3, WAV, or AAC songs to cloud storage and stream them with friends.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-xl bg-violet-600/40 hover:bg-violet-600/60 text-violet-200 border border-violet-500/30 text-xs font-semibold"
              >
                Upload Your First Track
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {tracks.map((t) => (
                <div
                  key={t.id}
                  className="group p-4 rounded-2xl glass-panel border border-white/[0.08] hover:border-violet-500/30 hover:bg-white/[0.03] transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 p-[1.5px] flex-shrink-0 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all">
                      <div className="h-full w-full bg-void-950 rounded-[10px] flex items-center justify-center text-violet-300">
                        <Music size={20} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-silver truncate group-hover:text-white">
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-muted truncate">{t.artist}</p>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {formatTime(t.duration || 0)} • {(t.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedInitialTrackId(t.id)
                      setShowCreateModal(true)
                    }}
                    className="p-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30 transition-all flex-shrink-0"
                    title="Start Music Jam with this song"
                  >
                    <Play size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL: CREATE ROOM */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void-950/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md p-6 rounded-3xl glass-panel border border-violet-500/30 bg-void-900 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={20} className="text-fuchsia-400" />
                    <h3 className="font-bold text-base text-silver">Start a Music Jam Room</h3>
                  </div>
                  <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-silver">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Room Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Late Night Beats, Chill Vibes"
                      value={newRoomTitle}
                      onChange={(e) => setNewRoomTitle(e.target.value)}
                      className="w-full bg-void-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Starter Track</label>
                    <select
                      value={selectedInitialTrackId || ''}
                      onChange={(e) => setSelectedInitialTrackId(Number(e.target.value))}
                      className="w-full bg-void-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    >
                      <option value="">Select a track...</option>
                      {tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} - {t.artist}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div>
                      <div className="text-xs font-semibold text-silver">Collaborative DJ Mode</div>
                      <div className="text-[10px] text-muted">Allow anyone in the room to add/queue songs</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isCollaborative}
                      onChange={(e) => setIsCollaborative(e.target.checked)}
                      className="rounded h-4 w-4 text-violet-500 accent-violet-600"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/[0.04] text-muted hover:text-silver text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingRoom}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs shadow-md"
                    >
                      {creatingRoom ? 'Creating...' : 'Launch Room'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: UPLOAD TRACK */}
        <AnimatePresence>
          {showUploadModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void-950/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md p-6 rounded-3xl glass-panel border border-cyan-500/30 bg-void-900 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UploadCloud size={20} className="text-cyan-400" />
                    <h3 className="font-bold text-base text-silver">Upload Cloud Audio</h3>
                  </div>
                  <button onClick={() => setShowUploadModal(false)} className="text-muted hover:text-silver">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleUploadTrack} className="space-y-4">
                  <div className="p-5 rounded-2xl border-2 border-dashed border-white/[0.15] hover:border-cyan-400/50 bg-white/[0.01] text-center cursor-pointer transition-colors relative">
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.aac,.flac,.m4a,.ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadFile(file)
                          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Music size={28} className="mx-auto text-cyan-400 mb-2" />
                    <div className="text-xs font-semibold text-silver">
                      {uploadFile ? uploadFile.name : 'Choose Audio File (.mp3, .wav, .aac, .flac)'}
                    </div>
                    <div className="text-[10px] text-muted mt-1">Direct upload to AWS S3 • Up to 200 MB</div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Song Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Starboy"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full bg-void-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Artist</label>
                      <input
                        type="text"
                        placeholder="e.g. The Weeknd"
                        value={uploadArtist}
                        onChange={(e) => setUploadArtist(e.target.value)}
                        className="w-full bg-void-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Album (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Starboy"
                        value={uploadAlbum}
                        onChange={(e) => setUploadAlbum(e.target.value)}
                        className="w-full bg-void-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {uploading && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Uploading to AWS S3...</span>
                        <span className="font-mono text-cyan-300">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-void-950 h-2 rounded-full overflow-hidden border border-white/[0.1]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/[0.04] text-muted hover:text-silver text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploading || !uploadFile}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-xs shadow-md disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Save & Upload'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ===========================================================================
  // RENDER: ACTIVE MUSIC JAM ROOM VIEW
  // ===========================================================================
  const currentTrack = currentRoom?.currentTrack

  return (
    <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden p-3 sm:p-5 space-y-4">
      {/* Hidden Native Audio Element */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={
            currentTrack.streamUrl?.startsWith('http')
              ? currentTrack.streamUrl
              : musicService.getStreamUrl(currentTrack.id)
          }
          onTimeUpdate={() => {
            if (audioRef.current && !isSeeking) {
              setCurrentTime(audioRef.current.currentTime)
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration)
              if (currentRoom?.currentPosition) {
                audioRef.current.currentTime = currentRoom.currentPosition
              }
              if (currentRoom?.isPlaying) {
                audioRef.current.play().catch(() => {})
                setIsPlaying(true)
              }
            }
          }}
          onEnded={handleAdvanceNext}
        />
      )}


      {/* Top Room Navigation Bar */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl glass-panel border border-violet-500/20 bg-void-950/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 p-[1.5px] flex-shrink-0">
            <div className="h-full w-full bg-void-950 rounded-[10px] flex items-center justify-center text-fuchsia-300">
              <Radio size={18} className={isPlaying ? 'animate-pulse text-fuchsia-400' : ''} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-silver truncate font-display">
                {currentRoom?.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30 text-[10px] font-mono font-bold">
                {currentRoom?.roomCode}
              </span>
            </div>
            <p className="text-[11px] text-muted truncate">
              Host: <b className="text-silver">{currentRoom?.hostName}</b> •{' '}
              {currentRoom?.isCollaborative ? 'Party Mode (Open DJ)' : 'Host-Controlled'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Members Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-silver">
            <Users size={13} className="text-cyan-400" />
            <span>{currentRoom?.members.length || 1} Listening</span>
          </div>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyRoomLink}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-muted hover:text-silver text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Copy Invite Link"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Invite'}</span>
          </button>

          {/* Toggle Queue */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showQueue
                ? 'bg-violet-600 text-white border-violet-500 shadow-glow'
                : 'bg-white/[0.04] text-muted hover:text-silver border-white/[0.08]'
            }`}
            title="Toggle Queue"
          >
            <ListMusic size={14} />
            <span className="hidden sm:inline">Queue ({currentRoom?.queue.length || 0})</span>
          </button>

          {/* Toggle Chat */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showChat
                ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-glow'
                : 'bg-white/[0.04] text-muted hover:text-silver border-white/[0.08]'
            }`}
            title="Toggle Chat"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Chat</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={() => {
              if (paramRoomCode) musicService.leaveRoom(paramRoomCode)
              navigate('/music')
            }}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 text-xs transition-all"
            title="Leave Room"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Room Body (Player + Drawers) */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden relative">
        {/* CENTER PLAYER STAGE */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 rounded-3xl glass-panel border border-white/[0.08] bg-void-950/60 relative overflow-hidden">
          {/* Floating Reaction Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {reactions.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 300, scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], y: -150, scale: [0.5, 1.5, 1.2, 1.8] }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
                style={{ left: `${r.x}%` }}
                className="absolute text-4xl sm:text-5xl filter drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]"
              >
                {r.emoji}
              </motion.div>
            ))}
          </div>

          {currentTrack ? (
            <div className="w-full max-w-lg flex flex-col items-center space-y-6 sm:space-y-8 z-10">
              {/* Spinning Cyber Vinyl Disc */}
              <div className="relative group">
                <div
                  className={`w-48 h-48 sm:w-60 sm:h-60 rounded-full bg-gradient-to-tr from-void-950 via-zinc-900 to-black p-2 border-4 border-zinc-800 shadow-[0_0_40px_rgba(168,85,247,0.3)] flex items-center justify-center relative ${
                    isPlaying ? 'animate-spin-slow' : ''
                  }`}
                  style={{ animationDuration: '8s' }}
                >
                  {/* Vinyl Grooves Texture */}
                  <div className="w-full h-full rounded-full border border-white/[0.08] flex items-center justify-center">
                    <div className="w-3/4 h-3/4 rounded-full border border-white/[0.05] flex items-center justify-center">
                      <div className="w-1/2 h-1/2 rounded-full border border-white/[0.1] flex items-center justify-center">
                        {/* Center Album Artwork */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-1 shadow-inner flex items-center justify-center overflow-hidden">
                          <div className="w-full h-full rounded-full bg-void-950 flex items-center justify-center">
                            <Music size={28} className="text-cyan-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Animated Pulsating Equalizer Waves */}
                {isPlaying && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-1 px-4 py-1.5 rounded-full bg-void-900/90 border border-cyan-400/30 shadow-lg">
                    {[16, 24, 12, 28, 20, 32, 18, 26, 14].map((h, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [8, h, 6] }}
                        transition={{ repeat: Infinity, duration: 0.6 + (i % 3) * 0.2, ease: 'easeInOut' }}
                        className="w-1 bg-gradient-to-t from-violet-500 to-cyan-400 rounded-full"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Track Metadata */}
              <div className="text-center space-y-1.5 max-w-sm">
                <h3 className="text-lg sm:text-2xl font-bold font-display text-white tracking-tight truncate">
                  {currentTrack.title}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-cyan-300 truncate">{currentTrack.artist}</p>
                {currentTrack.album && <p className="text-[11px] text-muted truncate">{currentTrack.album}</p>}
              </div>

              {/* Timeline Slider */}
              <div className="w-full space-y-1.5">
                <div className="relative flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={duration || currentTrack.duration || 100}
                    step={0.1}
                    value={currentTime}
                    disabled={!canControl}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    onTouchEnd={handleSeekEnd}
                    className="w-full h-2 bg-void-900 rounded-lg appearance-none cursor-pointer accent-fuchsia-500 border border-white/[0.08]"
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-muted">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration || currentTrack.duration || 0)}</span>
                </div>
              </div>

              {/* Playback Controls & Volume */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Volume Slider */}
                <div className="flex items-center gap-2 text-muted">
                  <button onClick={() => setIsMuted(!isMuted)} className="hover:text-silver">
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value))
                      setIsMuted(false)
                    }}
                    className="w-20 h-1.5 bg-void-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Main Play / Pause & Skip Buttons */}
                <div className="flex items-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={handleTogglePlay}
                    disabled={!canControl}
                    className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[2px] shadow-[0_0_24px_rgba(236,72,153,0.4)] disabled:opacity-50"
                  >
                    <div className="h-full w-full bg-void-950 rounded-[14px] flex items-center justify-center text-white">
                      {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAdvanceNext}
                    disabled={!canControl || currentRoom?.queue.length === 0}
                    className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-silver border border-white/[0.08] transition-all"
                    title="Next Track in Queue"
                  >
                    <SkipForward size={18} />
                  </motion.button>
                </div>

                {/* Quick Add to Queue Button */}
                <button
                  onClick={() => setShowAddTrackModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  <span>Add Song</span>
                </button>
              </div>

              {/* Floating Reaction Bar */}
              <div className="flex items-center justify-center gap-2 p-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
                {REACTION_EMOJIS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleSendReaction(emoji)}
                    className="p-1.5 text-lg hover:bg-white/[0.08] rounded-xl transition-all"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 max-w-sm">
              <Disc3 size={48} className="mx-auto text-muted/50 animate-spin-slow" />
              <div className="text-base font-bold text-silver">No track loaded in this room</div>
              <p className="text-xs text-muted">
                Choose a song from your cloud music library to start streaming in this Jam room.
              </p>
              <button
                onClick={() => setShowAddTrackModal(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs shadow-md"
              >
                Select Starter Track
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: QUEUE DRAWER */}
        <AnimatePresence>
          {showQueue && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-panel border border-white/[0.08] rounded-3xl p-4 flex flex-col h-full overflow-hidden flex-shrink-0 z-30"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
                <div className="flex items-center gap-2">
                  <ListMusic size={16} className="text-violet-400" />
                  <h3 className="font-bold text-sm text-silver">Up Next Queue</h3>
                </div>
                <button onClick={() => setShowQueue(false)} className="text-muted hover:text-silver">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {currentRoom?.queue.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted">
                    Queue is empty. Add songs to keep the music playing!
                  </div>
                ) : (
                  currentRoom?.queue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs text-muted w-4 text-center">{idx + 1}</span>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-silver truncate">{item.track.title}</h5>
                          <p className="text-[10px] text-muted truncate">
                            {item.track.artist} • By {item.addedByName}
                          </p>
                        </div>
                      </div>

                      {canControl && (
                        <button
                          onClick={() => handleRemoveFromQueue(item.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.06] mt-2">
                <button
                  onClick={() => setShowAddTrackModal(true)}
                  className="w-full py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-400/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Songs to Queue</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RIGHT SIDEBAR: IN-ROOM CHAT DRAWER */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-panel border border-white/[0.08] rounded-3xl p-4 flex flex-col h-full overflow-hidden flex-shrink-0 z-30"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-fuchsia-400" />
                  <h3 className="font-bold text-sm text-silver">In-Room Chat</h3>
                </div>
                <button onClick={() => setShowChat(false)} className="text-muted hover:text-silver">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="p-8 text-center text-muted">
                    No messages yet. Say hi or drop a reaction!
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-cyan-300">{msg.senderName}</span>
                        <span className="text-muted font-mono">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-silver">{msg.content}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChatMessage} className="pt-2 border-t border-white/[0.06] mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full bg-void-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-fuchsia-400"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white transition-all flex-shrink-0"
                >
                  <Send size={13} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MODAL: ADD TRACK TO ROOM / QUEUE */}
      <AnimatePresence>
        {showAddTrackModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-violet-500/30 bg-void-900 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Music size={20} className="text-cyan-400" />
                  <h3 className="font-bold text-base text-silver">Choose from Cloud Library</h3>
                </div>
                <button onClick={() => setShowAddTrackModal(false)} className="text-muted hover:text-silver">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {tracks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h5 className="text-xs sm:text-sm font-bold text-silver truncate">{t.title}</h5>
                      <p className="text-[11px] text-muted truncate">{t.artist}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleSelectTrackToPlay(t.id)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/60 text-cyan-200 border border-cyan-400/30 text-xs font-bold"
                      >
                        Play Now
                      </button>
                      <button
                        onClick={() => handleAddToQueue(t.id)}
                        className="px-3 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/60 text-violet-200 border border-violet-400/30 text-xs font-bold"
                      >
                        + Queue
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setShowAddTrackModal(false)
                    setShowUploadModal(true)
                  }}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <UploadCloud size={14} />
                  <span>Upload new song to cloud</span>
                </button>
                <button
                  onClick={() => setShowAddTrackModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] text-muted hover:text-silver text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
