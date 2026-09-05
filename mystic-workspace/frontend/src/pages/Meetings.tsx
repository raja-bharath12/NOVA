import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video,
  Plus,
  Calendar as CalendarIcon,
  ArrowRight,
  Clock,
  Users,
  Sparkles,
  X,
  Play,
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'
import { meetingService } from '../services/meetingService'
import type { Meeting } from '../types'

export default function Meetings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [roomCodeInput, setRoomCodeInput] = useState('')

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleDescription, setScheduleDescription] = useState('')
  const [scheduleDateTime, setScheduleDateTime] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadMeetings()
  }, [])

  async function loadMeetings() {
    try {
      setLoading(true)
      const data = await meetingService.getUserMeetings()
      setMeetings(data)
    } catch (err) {
      console.error('Failed to load meetings', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartInstantMeeting() {
    try {
      setCreating(true)
      const meeting = await meetingService.createInstantMeeting(
        `${user?.name?.split(' ')[0]}'s Workspace Meeting`,
        'Instant ad-hoc collaboration room'
      )
      navigate(`/meetings/room/${meeting.roomCode}`)
    } catch (err) {
      console.error('Failed to create instant meeting', err)
    } finally {
      setCreating(false)
    }
  }

  function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault()
    const code = roomCodeInput.trim().toLowerCase()
    if (!code) return
    navigate(`/meetings/room/${code}`)
  }

  async function handleScheduleMeeting(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduleTitle.trim() || !scheduleDateTime) return

    try {
      setCreating(true)
      const scheduled = await meetingService.scheduleMeeting(
        scheduleTitle.trim(),
        new Date(scheduleDateTime).toISOString(),
        scheduleDescription.trim() || undefined
      )
      setMeetings((prev) => [scheduled, ...prev])
      setShowScheduleModal(false)
      setScheduleTitle('')
      setScheduleDescription('')
      setScheduleDateTime('')
    } catch (err) {
      console.error('Failed to schedule meeting', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-gradient">
            Audio & Video Meeting Rooms
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1">
            Ultra-low latency peer-to-peer audio, video, and screen sharing powered by WebRTC.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowScheduleModal(true)}
            className="h-10 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-silver border border-white/[0.08] text-xs font-medium flex items-center gap-2 transition-all"
          >
            <CalendarIcon size={15} />
            <span>Schedule</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={creating}
            onClick={handleStartInstantMeeting}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <Video size={16} />
            <span>{creating ? 'Creating Room...' : 'Start Instant Meeting'}</span>
          </motion.button>
        </div>
      </div>

      {/* Quick Join & Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Instant Start Card */}
        <GlassPanel tilt className="flex flex-col justify-between p-6">
          <div>
            <div className="h-10 w-10 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-400 mb-4 shadow-glow">
              <Sparkles size={20} />
            </div>
            <h3 className="text-base font-semibold text-silver">Instant Meeting</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Launch a zero-latency WebRTC conference with live screen sharing and encrypted audio/video.
            </p>
          </div>
          <button
            onClick={handleStartInstantMeeting}
            disabled={creating}
            className="mt-6 w-full h-9 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/30 text-xs font-semibold text-silver flex items-center justify-center gap-2 transition-all shadow-glow"
          >
            <span>Launch Room</span>
            <ArrowRight size={14} />
          </button>
        </GlassPanel>

        {/* Join by Code Card */}
        <GlassPanel tilt className="flex flex-col justify-between p-6">
          <div>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-4 shadow-glow-cyan">
              <Video size={20} />
            </div>
            <h3 className="text-base font-semibold text-silver">Join with Code</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Enter a meeting room code or invite link to join your team.
            </p>
          </div>
          <form onSubmit={handleJoinByCode} className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="nova-abc-xyz"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-cyan-400/50"
            />
            <button
              type="submit"
              disabled={!roomCodeInput.trim()}
              className="px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-void-950 font-bold text-xs flex items-center justify-center disabled:opacity-40 transition-all shadow-glow-cyan"
            >
              Join
            </button>
          </form>
        </GlassPanel>

        {/* Schedule Card */}
        <GlassPanel tilt className="flex flex-col justify-between p-6">
          <div>
            <div className="h-10 w-10 rounded-xl bg-lavender/20 border border-lavender/30 flex items-center justify-center text-lavender mb-4">
              <CalendarIcon size={20} />
            </div>
            <h3 className="text-base font-semibold text-silver">Schedule Conference</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Book upcoming meeting slots and distribute meeting codes to participants in advance.
            </p>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="mt-6 w-full h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-silver flex items-center justify-center gap-2 transition-all"
          >
            <span>Schedule Slot</span>
            <Plus size={14} />
          </button>
        </GlassPanel>
      </div>

      {/* Scheduled & Active Meetings Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-silver">Your Meetings</h2>
          <span className="label-tracked text-xs text-lavender">{meetings.length} Total</span>
        </div>

        {loading ? (
          <div className="glass-panel p-8 text-center text-xs text-muted">Loading meetings...</div>
        ) : meetings.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <Video size={36} className="mx-auto text-violet-400/40 mb-3" />
            <p className="text-sm font-semibold text-silver">No meetings scheduled</p>
            <p className="text-xs text-muted mt-1">Start an instant room or schedule a call to collaborate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meetings.map((m) => {
              const isActive = m.status === 'ACTIVE'

              return (
                <div
                  key={m.id}
                  className={`glass-panel p-5 flex flex-col justify-between border transition-all ${
                    isActive
                      ? 'border-emerald-500/40 bg-emerald-500/[0.04] shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'border-white/[0.06] hover:border-violet-400/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : m.status === 'ENDED'
                            ? 'bg-muted/20 text-muted'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                      <span className="font-mono text-xs text-lavender bg-void-900/60 px-2 py-0.5 rounded border border-white/[0.06]">
                        {m.roomCode}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-silver">{m.title}</h3>
                    {m.description && <p className="text-xs text-muted mt-1">{m.description}</p>}

                    <div className="flex items-center gap-4 text-xs text-muted mt-4">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-violet-400" />
                        <span>Host: {m.host.name}</span>
                      </div>
                      {m.scheduledStartTime && (
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-cyan-400" />
                          <span>
                            {new Date(m.scheduledStartTime).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-[11px] text-muted">
                      Created {new Date(m.createdAt).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => navigate(`/meetings/room/${m.roomCode}`)}
                      className={`h-8 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-void-950 shadow-[0_0_16px_rgba(16,185,129,0.4)]'
                          : 'bg-violet-600/30 hover:bg-violet-600/50 text-silver border border-violet-400/30 shadow-glow'
                      }`}
                    >
                      <Play size={12} />
                      <span>{isActive ? 'Join Active Call' : 'Enter Room'}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== SCHEDULE MEETING MODAL ===== */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-6 border border-violet-500/30 shadow-glow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-silver">Schedule Conference</h3>
                <button onClick={() => setShowScheduleModal(false)} className="text-muted hover:text-lavender">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleScheduleMeeting} className="space-y-4">
                <div>
                  <label className="label-tracked block mb-1">Meeting Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q3 Sprint Planning"
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                <div>
                  <label className="label-tracked block mb-1">Description (Optional)</label>
                  <textarea
                    placeholder="Agenda, notes, or discussion points..."
                    value={scheduleDescription}
                    onChange={(e) => setScheduleDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                <div>
                  <label className="label-tracked block mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-silver focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-muted hover:text-silver"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !scheduleTitle.trim() || !scheduleDateTime}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow disabled:opacity-40"
                  >
                    {creating ? 'Saving...' : 'Confirm Schedule'}
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
