import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
  MessageSquare
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import GlassPanel from '../components/dashboard/GlassPanel'

export default function MeetingRoom() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [token, setToken] = useState<string>('')
  const [livekitUrl, setLivekitUrl] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<boolean>(false)

  useEffect(() => {
    if (!roomCode) return
    fetchLiveKitToken()
  }, [roomCode])

  async function fetchLiveKitToken() {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get<{ token: string; url: string }>('/livekit/token', {
        params: { room: roomCode }
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

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleDisconnect = () => {
    navigate('/meetings')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] w-full space-y-3 overflow-hidden">
      {/* Top Meeting Header Bar */}
      <GlassPanel className="p-3 md:p-4 border border-white/[0.08] shadow-glass flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-400/30 flex items-center justify-center text-cyan-300 shadow-glow">
            <Video size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-display font-bold text-silver">
                NOVA Secure Meeting
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                LiveKit Cloud
              </span>
            </div>
            <p className="text-[11px] text-muted flex items-center gap-1.5 font-mono">
              <span>Room: {roomCode}</span>
              <button
                onClick={handleCopyCode}
                className="hover:text-cyan-300 transition-colors p-0.5"
                title="Copy room code"
              >
                {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-silver font-medium transition-all"
          >
            {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedCode ? 'Copied Link' : 'Invite Link'}</span>
          </button>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-rose-300 transition-all shadow-sm"
          >
            <PhoneOff size={14} />
            <span>Leave</span>
          </button>
        </div>
      </GlassPanel>

      {/* Main Video Conference Area */}
      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-void-950/80 backdrop-blur-md relative">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 animate-pulse shadow-glow">
              <Sparkles size={24} />
            </div>
            <h3 className="text-base font-semibold text-silver">
              Connecting to LiveKit Secure Meeting...
            </h3>
            <p className="text-xs text-muted max-w-sm">
              Establishing global WebRTC media mesh with noise cancellation and video streaming.
            </p>
          </div>
        ) : error ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-6">
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
          <div className="h-full w-full livekit-container">
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
        ) : null}
      </div>
    </div>
  )
}
