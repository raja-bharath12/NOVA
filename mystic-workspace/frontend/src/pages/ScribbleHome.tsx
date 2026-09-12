import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Palette,
  Gamepad2,
  Plus,
  Play,
  Users,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  Hash,
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import scribbleService from '../services/scribbleService'
import type { RoomState } from '../types/scribble'

export default function ScribbleHome() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [publicRooms, setPublicRooms] = useState<RoomState[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')

  // Create Room Form State
  const [title, setTitle] = useState('')
  const [roundCount, setRoundCount] = useState(3)
  const [turnDuration, setTurnDuration] = useState(80)
  const [maxPlayers, setMaxPlayers] = useState(12)
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true)
      const list = await scribbleService.listPublicRooms()
      setPublicRooms(list)
    } catch (err) {
      console.warn('Could not fetch public scribble rooms', err)
    } finally {
      setLoadingRooms(false)
    }
  }

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 8000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreating(true)
      const room = await scribbleService.createRoom({
        title: title.trim() || undefined,
        roundCount,
        turnDurationSeconds: turnDuration,
        maxPlayers,
        isPublic,
      })
      showToast('Scribble Room created!', 'success')
      navigate(`/scribble/room/${room.roomCode}`)
    } catch (err) {
      showToast('Failed to create Scribble room', 'warning')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCodeInput.trim().toUpperCase()
    if (!code) return
    navigate(`/scribble/room/${code}`)
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-black/60 border border-purple-500/20 p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
              <Sparkles size={13} className="animate-spin" />
              <span>Real-Time Multiplayer Arena</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Scribble & Guess</span>
              <Palette className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
            </h1>
            <p className="text-sm sm:text-base text-white/70 max-w-2xl leading-relaxed">
              Create a private room or jump into public lobbies. Draw with live brushes and flood
              fill, guess in real time, and earn speed points on the live leaderboard!
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-glow transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={18} />
              <span>Create Private Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Join With Code & Public Lobbies Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Join With Code Card */}
        <GlassPanel className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Join by Code</h2>
            </div>
            <p className="text-xs text-white/60 mb-4">
              Have a room invite code or shared link from a friend? Enter it below to jump straight
              into the action.
            </p>

            <form onSubmit={handleJoinByCode} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. SCRIB-842"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="w-full bg-white/5 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm text-white font-mono tracking-wider placeholder-white/40 focus:outline-none transition-all uppercase"
              />
              <button
                type="submit"
                disabled={!joinCodeInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={14} className="fill-current" />
                <span>Enter Room</span>
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
            <span>Standard Turn: 80s</span>
            <span>2 - 12 Players</span>
          </div>
        </GlassPanel>

        {/* Public Lobbies List (2 cols on large screen) */}
        <div className="lg:col-span-2">
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Active Public Lobbies</h2>
              </div>
              <button
                onClick={fetchRooms}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                Refresh
              </button>
            </div>

            {loadingRooms ? (
              <p className="text-xs text-white/40 py-8 text-center">Scanning active arenas...</p>
            ) : publicRooms.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-white/50">No public rooms active right now.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 text-xs font-semibold border border-purple-500/20 transition-all inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Be the first to create one!</span>
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {publicRooms.map((room) => (
                  <div
                    key={room.roomCode}
                    onClick={() => navigate(`/scribble/room/${room.roomCode}`)}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-purple-500/40 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-purple-400">
                          {room.roomCode}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          {room.phase}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                        {room.title}
                      </h3>
                      <p className="text-xs text-white/50 mt-1">Host: {room.hostName}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-white/60 flex items-center gap-1">
                        <Users size={13} />
                        <span>{room.players.length} / {room.settings.maxPlayers}</span>
                      </span>
                      <span className="text-purple-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Join</span>
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#13141f] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-1">Create Scribble Arena</h2>
            <p className="text-xs text-white/50 mb-6">
              Configure room parameters, round count, and turn duration.
            </p>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Room Title</label>
                <input
                  type="text"
                  placeholder="e.g. Friday Fun Arena"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/70 block mb-1">Rounds</label>
                  <select
                    value={roundCount}
                    onChange={(e) => setRoundCount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={2} className="bg-[#13141f]">2 Rounds</option>
                    <option value={3} className="bg-[#13141f]">3 Rounds (Standard)</option>
                    <option value={5} className="bg-[#13141f]">5 Rounds</option>
                    <option value={8} className="bg-[#13141f]">8 Rounds (Marathon)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/70 block mb-1">Draw Time</label>
                  <select
                    value={turnDuration}
                    onChange={(e) => setTurnDuration(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={60} className="bg-[#13141f]">60 Seconds</option>
                    <option value={80} className="bg-[#13141f]">80 Seconds (Balanced)</option>
                    <option value={100} className="bg-[#13141f]">100 Seconds</option>
                    <option value={120} className="bg-[#13141f]">120 Seconds (Pro)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded bg-white/5 border-white/20 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="isPublic" className="text-xs text-white/80 cursor-pointer">
                  List as Public Room in Dashboard Hub
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-glow transition-all disabled:opacity-50"
                >
                  {creating ? 'Launching...' : 'Create & Enter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
