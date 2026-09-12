import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Gamepad2,
  Palette,
  Sparkles,
  Play,
  Plus,
  Users,
  Trophy,
  Brain,
  Grid3X3,
  Flame,
  ArrowRight,
  Clock,
  HelpCircle,
  Hash,
  Crown,
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import scribbleService from '../services/scribbleService'
import type { RoomState } from '../types/scribble'

export default function Games() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming'>('all')
  const [publicRooms, setPublicRooms] = useState<RoomState[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [showCreateScribbleModal, setShowCreateScribbleModal] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')

  // Create Scribble Room Form State
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
  }, [])

  const handleCreateScribbleRoom = async (e: React.FormEvent) => {
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
      showToast('Failed to create Scribble room. Please verify backend connection.', 'warning')
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
      {/* 1. HERO BANNER - GAMING HUB */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950/60 via-[#15162a] to-black/80 border border-purple-500/30 p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
              <Gamepad2 size={14} className="animate-pulse" />
              <span>NOVA Multiplayer Gaming Hub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Games & Arcade</span>
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-pink-400" />
            </h1>
            <p className="text-sm sm:text-base text-white/70 max-w-2xl leading-relaxed">
              Discover real-time multiplayer games designed for team fun, competitive speed, and creative drawing. Jump into live matches or explore upcoming additions!
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 self-start md:self-center">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-purple-600 text-white shadow-glow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              All Games (4)
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'live'
                  ? 'bg-purple-600 text-white shadow-glow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              🟢 Live (1)
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-purple-600 text-white shadow-glow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              🔮 Upcoming (3)
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN GAMES CATALOG GRID */}
      <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
        {/* GAME 1: SCRIBBLER & GUESS (LIVE NOW) */}
        {(activeTab === 'all' || activeTab === 'live') && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/30 via-[#16172e] to-[#121324] border border-purple-500/40 p-6 sm:p-7 shadow-2xl flex flex-col justify-between group hover:border-purple-500/80 transition-all">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-glow group-hover:scale-110 transition-transform">
                  <Palette className="w-7 h-7" />
                </div>
                <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live & Ready to Play
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-purple-300 transition-colors">
                  Scribble & Guess
                </h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1 leading-relaxed">
                  Real-time multiplayer drawing & guessing arena. Draw synchronously on an interactive canvas with flood fill, guess secret words in live chat, and earn speed points!
                </p>
              </div>

              {/* Game Feature Tags */}
              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/70 border border-white/5 font-medium">
                  👥 2 - 12 Players
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/70 border border-white/5 font-medium">
                  ⏱️ 80s Turns
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/70 border border-white/5 font-medium">
                  🎨 Live Canvas Sync
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowCreateScribbleModal(true)}
                className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-glow transition-all hover:scale-105 active:scale-95"
              >
                <Plus size={15} />
                <span>Create Arena</span>
              </button>

              <button
                onClick={() => navigate('/scribble')}
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Browse Lobbies</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* GAME 2: TRIVIA BLITZ (UPCOMING) */}
        {(activeTab === 'all' || activeTab === 'upcoming') && (
          <div className="relative overflow-hidden rounded-3xl bg-white/[0.02] border border-white/10 p-6 sm:p-7 flex flex-col justify-between opacity-85 hover:opacity-100 transition-opacity">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/40 flex items-center justify-center text-amber-300">
                  <Brain className="w-7 h-7" />
                </div>
                <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  🔮 Coming Soon
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Trivia Blitz</h2>
                <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                  Fast-paced multiplayer quiz showdown with live buzzer mechanics, category voting, streak multipliers, and instant answer reveals.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  👥 2 - 20 Players
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  ⚡ Buzzer Mode
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  🧠 AI Questions
                </span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-white/40 italic">In Active Development</span>
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-white/5 text-white/30 text-xs font-semibold cursor-not-allowed"
              >
                Notify Me
              </button>
            </div>
          </div>
        )}

        {/* GAME 3: WORDLE ROYALE (UPCOMING) */}
        {(activeTab === 'all' || activeTab === 'upcoming') && (
          <div className="relative overflow-hidden rounded-3xl bg-white/[0.02] border border-white/10 p-6 sm:p-7 flex flex-col justify-between opacity-85 hover:opacity-100 transition-opacity">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                  <Grid3X3 className="w-7 h-7" />
                </div>
                <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  🔮 Coming Soon
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Wordle Royale</h2>
                <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                  Cooperative and competitive 5-letter word puzzle battle. Guess the mystery word on synchronized matrix boards before opponents solve it!
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  👥 1 - 8 Players
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  🔤 6 Attempts
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  🏆 Ranked Leaderboard
                </span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-white/40 italic">In Active Development</span>
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-white/5 text-white/30 text-xs font-semibold cursor-not-allowed"
              >
                Notify Me
              </button>
            </div>
          </div>
        )}

        {/* GAME 4: GRANDMASTER CHESS (UPCOMING) */}
        {(activeTab === 'all' || activeTab === 'upcoming') && (
          <div className="relative overflow-hidden rounded-3xl bg-white/[0.02] border border-white/10 p-6 sm:p-7 flex flex-col justify-between opacity-85 hover:opacity-100 transition-opacity">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 border border-pink-500/40 flex items-center justify-center text-pink-300">
                  <Crown className="w-7 h-7" />
                </div>
                <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                  🔮 Coming Soon
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Grandmaster Chess</h2>
                <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                  Real-time 1v1 multiplayer chess matches with clock presets (Blitz, Rapid, Bullet), live spectator commentary, and match replay analysis.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  👥 2 Players + Spectators
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  ♟️ ELO Rating
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 border border-white/5">
                  ⏱️ Clock Timers
                </span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-white/40 italic">In Active Development</span>
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-white/5 text-white/30 text-xs font-semibold cursor-not-allowed"
              >
                Notify Me
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Scribble Modal */}
      {showCreateScribbleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#13141f] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-1">Create Scribble Arena</h2>
            <p className="text-xs text-white/50 mb-6">
              Configure room parameters, round count, and turn duration.
            </p>

            <form onSubmit={handleCreateScribbleRoom} className="space-y-4">
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
                  onClick={() => setShowCreateScribbleModal(false)}
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
