import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Settings,
  ShieldCheck,
  Users,
  Sparkles,
  Loader2
} from 'lucide-react'
import Hls from 'hls.js'
import type { WatchControlSignal, WatchMedia } from '../../types'

interface WatchPlayerProps {
  media: WatchMedia
  isHost: boolean
  streamUrl: string
  initialPosition?: number
  initialIsPlaying?: boolean
  onSendControl: (signal: Partial<WatchControlSignal>) => void
  incomingSignal: WatchControlSignal | null
  onToggleChat?: () => void
  isChatOpen?: boolean
  unreadCount?: number
}

export type VideoQuality = 'Auto' | '1080p' | '720p' | '480p' | '360p'

export default function WatchPlayer({
  media,
  isHost,
  streamUrl,
  initialPosition = 0,
  initialIsPlaying = false,
  onSendControl,
  incomingSignal,
  onToggleChat,
  isChatOpen = false,
  unreadCount = 0
}: WatchPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  // Local-only state (never broadcasted to other participants)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('nova_watch_volume')
    return saved ? Number(saved) : 0.8
  })
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('nova_watch_muted') === 'true'
  })
  const [quality, setQuality] = useState<VideoQuality>('Auto')
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Anti-loop flag to distinguish remote updates from user gestures
  const isApplyingRemoteUpdateRef = useRef(false)

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Initialize HLS or native video stream
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.volume = isMuted ? 0 : volume
    video.muted = isMuted

    // If an HLS manifest is provided
    if (media.manifestUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      })
      hls.loadSource(media.manifestUrl)
      hls.attachMedia(video)
      hlsRef.current = hls

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (initialPosition > 0) {
          video.currentTime = initialPosition
        }
        if (initialIsPlaying) {
          video.play().catch(() => {})
        }
      })

      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    } else {
      // Standard HTTP 206 partial content streaming via streamUrl
      video.src = streamUrl
      video.load()

      const handleLoadedMetadata = () => {
        if (initialPosition > 0) {
          video.currentTime = initialPosition
        }
        if (initialIsPlaying) {
          video.play().catch(() => {})
        }
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
    }
  }, [streamUrl, media.manifestUrl])

  // Handle incoming remote synchronization signals (PLAY, PAUSE, SEEK, SYNC)
  useEffect(() => {
    if (!incomingSignal) return
    const video = videoRef.current
    if (!video) return

    const { type, position, isPlaying: remoteIsPlaying, serverTimestamp, playbackRate } = incomingSignal

    isApplyingRemoteUpdateRef.current = true

    // Compute expected target position if server timestamp is present
    let targetPos = position ?? video.currentTime
    if (remoteIsPlaying && serverTimestamp) {
      const elapsedSec = (Date.now() - new Date(serverTimestamp).getTime()) / 1000.0
      if (elapsedSec > 0 && elapsedSec < 60) {
        targetPos += elapsedSec * (playbackRate || 1.0)
      }
    }

    // Apply seek/drift correction if drift exceeds 1.5 seconds
    if (position !== undefined && Math.abs(video.currentTime - targetPos) > 1.5) {
      video.currentTime = targetPos
    }

    if (type === 'PLAY') {
      if (video.paused) {
        video.play().catch(() => {})
      }
      setIsPlaying(true)
    } else if (type === 'PAUSE') {
      if (!video.paused) {
        video.pause()
      }
      setIsPlaying(false)
      if (position !== undefined) {
        video.currentTime = position
      }
    } else if (type === 'SEEK' || type === 'SYNC') {
      if (position !== undefined) {
        video.currentTime = targetPos
      }
      if (remoteIsPlaying && video.paused) {
        video.play().catch(() => {})
        setIsPlaying(true)
      } else if (!remoteIsPlaying && !video.paused) {
        video.pause()
        setIsPlaying(false)
      }
    }

    const timer = setTimeout(() => {
      isApplyingRemoteUpdateRef.current = false
    }, 150)

    return () => clearTimeout(timer)
  }, [incomingSignal])

  // Auto-hide custom controls when mouse is inactive
  const handleMouseMove = () => {
    setControlsVisible(true)
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current)
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false)
        setShowQualityMenu(false)
      }
    }, 3500)
  }

  // Handle video element events
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)

    // Update buffered progress
    if (videoRef.current.buffered.length > 0) {
      const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
      setBufferedEnd(end)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  // Play / Pause Toggle
  const handleTogglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true)
        if (!isApplyingRemoteUpdateRef.current && isHost) {
          onSendControl({
            type: 'PLAY',
            position: video.currentTime,
            isPlaying: true,
            playbackRate: 1.0
          })
        }
      }).catch(() => {})
    } else {
      video.pause()
      setIsPlaying(false)
      if (!isApplyingRemoteUpdateRef.current && isHost) {
        onSendControl({
          type: 'PAUSE',
          position: video.currentTime,
          isPlaying: false,
          playbackRate: 1.0
        })
      }
    }
  }

  // Timeline Seek Change
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    if (!videoRef.current) return

    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)

    if (isHost && !isApplyingRemoteUpdateRef.current) {
      onSendControl({
        type: 'SEEK',
        position: newTime,
        isPlaying: !videoRef.current.paused,
        playbackRate: 1.0
      })
    }
  }

  // Skip 10 seconds
  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds))
    videoRef.current.currentTime = target
    setCurrentTime(target)

    if (isHost && !isApplyingRemoteUpdateRef.current) {
      onSendControl({
        type: 'SEEK',
        position: target,
        isPlaying: !videoRef.current.paused,
        playbackRate: 1.0
      })
    }
  }

  // Local Volume Change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
    }
    localStorage.setItem('nova_watch_volume', String(val))
    localStorage.setItem('nova_watch_muted', String(val === 0))
  }

  // Local Mute Toggle
  const handleToggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (videoRef.current) {
      videoRef.current.muted = nextMuted
      videoRef.current.volume = nextMuted ? 0 : volume
    }
    localStorage.setItem('nova_watch_muted', String(nextMuted))
  }

  // Local Quality Selection
  const handleSelectQuality = (q: VideoQuality) => {
    setQuality(q)
    setShowQualityMenu(false)
    if (hlsRef.current && q !== 'Auto') {
      const height = parseInt(q.replace('p', ''))
      const levels = hlsRef.current.levels
      const index = levels.findIndex((l) => l.height === height)
      if (index !== -1) {
        hlsRef.current.currentLevel = index
      }
    } else if (hlsRef.current) {
      hlsRef.current.currentLevel = -1 // Auto
    }
  }

  // Fullscreen Toggle
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden select-none group rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-2xl"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onClick={handleTogglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering Spinner */}
      <AnimatePresence>
        {isBuffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-20"
          >
            <div className="flex flex-col items-center gap-2 text-cyan-300">
              <Loader2 size={36} className="animate-spin" />
              <span className="text-xs font-medium tracking-wide">Buffering stream...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Overlay Badge (Room Info & Host Control Indicator) */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-auto"
          >
            <div className="flex items-center gap-2.5 bg-void-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/[0.1] shadow-glow">
              <span className="text-xs font-semibold text-silver truncate max-w-[200px] sm:max-w-md">
                {media.title}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                {quality}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-md border shadow-glow ${
                  isHost
                    ? 'bg-gradient-to-r from-violet-600/30 to-cyan-500/30 border-cyan-400/40 text-cyan-300'
                    : 'bg-void-950/80 border-white/[0.1] text-silver/80'
                }`}
              >
                {isHost ? (
                  <>
                    <ShieldCheck size={14} className="text-cyan-400" />
                    <span className="text-[11px] font-semibold">Host Playback Control</span>
                  </>
                ) : (
                  <>
                    <Users size={14} className="text-purple-400" />
                    <span className="text-[11px]">Synchronized with Host</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Custom Controls Bar */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 flex flex-col gap-2.5 pointer-events-auto"
          >
            {/* Timeline Scrubber */}
            <div className="relative w-full group/scrubber py-1 flex items-center">
              {/* Buffered Range Bar */}
              <div
                className="absolute h-1.5 rounded-full bg-white/20 pointer-events-none transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />

              {/* Played Progress Bar */}
              <div
                className="absolute h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 pointer-events-none shadow-glow transition-all"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Range Input Slider */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                disabled={!isHost}
                onChange={handleSeek}
                className={`relative w-full h-1.5 bg-white/10 rounded-full appearance-none outline-none transition-all ${
                  isHost ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                }`}
                style={{
                  accentColor: '#22d3ee'
                }}
              />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between gap-3 text-silver">
              {/* Left Group: Play/Pause, Skips, Volume & Time */}
              <div className="flex items-center gap-2.5 sm:gap-4">
                {/* Play / Pause */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleTogglePlay}
                  className="h-10 w-10 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shadow-glow transition-all"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-current ml-0.5" />}
                </motion.button>

                {/* Skip Backward 10s */}
                <button
                  onClick={() => handleSkip(-10)}
                  disabled={!isHost}
                  className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors disabled:opacity-30"
                  title="Skip back 10s"
                >
                  <RotateCcw size={17} />
                </button>

                {/* Skip Forward 10s */}
                <button
                  onClick={() => handleSkip(10)}
                  disabled={!isHost}
                  className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors disabled:opacity-30"
                  title="Skip forward 10s"
                >
                  <RotateCw size={17} />
                </button>

                {/* Volume Slider (Local Only) */}
                <div className="flex items-center gap-2 group/volume">
                  <button
                    onClick={handleToggleMute}
                    className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={18} className="text-rose-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 sm:w-20 h-1.5 bg-white/20 rounded-full appearance-none outline-none cursor-pointer"
                    style={{ accentColor: '#22d3ee' }}
                    title={`Volume: ${Math.round(isMuted ? 0 : volume * 100)}% (Local)`}
                  />
                </div>

                {/* Time Display */}
                <div className="text-xs font-mono font-medium text-silver/80 select-none">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-muted mx-1">/</span>
                  <span className="text-muted">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Group: Quality, Chat Toggle, Fullscreen */}
              <div className="flex items-center gap-2 sm:gap-3 relative">
                {/* Quality Menu Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu((q) => !q)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-mono font-medium flex items-center gap-1.5 text-silver transition-colors"
                    title="Video Quality (Local)"
                  >
                    <Settings size={14} className="text-cyan-400" />
                    <span>{quality}</span>
                  </button>

                  <AnimatePresence>
                    {showQualityMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: -8 }}
                        exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        className="absolute bottom-full right-0 mb-2 w-32 p-1.5 rounded-2xl bg-void-950/95 border border-white/[0.1] shadow-2xl backdrop-blur-xl flex flex-col gap-1 z-40"
                      >
                        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider px-2 py-1">
                          Quality
                        </span>
                        {(['Auto', '1080p', '720p', '480p', '360p'] as VideoQuality[]).map((q) => (
                          <button
                            key={q}
                            onClick={() => handleSelectQuality(q)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors ${
                              quality === q
                                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                                : 'text-silver hover:bg-white/[0.06]'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Fullscreen Button */}
                <button
                  onClick={handleToggleFullscreen}
                  className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
