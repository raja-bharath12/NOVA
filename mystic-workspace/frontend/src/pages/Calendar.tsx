import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  Video,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { eventService } from '../services/eventService'
import type { EventItem } from '../types'

export default function Calendar() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Create Modal State
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [meetingLink, setMeetingLink] = useState('')

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      setLoading(true)
      const data = await eventService.list()
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startTime || !endTime) return

    try {
      const created = await eventService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
      })
      setEvents((prev) => [...prev, created])
      setShowModal(false)
      setTitle('')
      setDescription('')
      setStartTime('')
      setEndTime('')
      setLocation('')
      setMeetingLink('')
    } catch (err) {
      console.error('Failed to create event', err)
    }
  }

  async function handleDeleteEvent(id?: number) {
    if (!id) return
    try {
      await eventService.delete(id)
      setEvents((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      console.error('Failed to delete event', err)
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-gradient">
            Schedule & Events
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1">
            Manage your schedule, sync team meetings, and plan sprints.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowModal(true)}
          className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all self-start md:self-auto"
        >
          <Plus size={16} />
          <span>New Event</span>
        </motion.button>
      </div>

      {/* Events Grid / List */}
      {loading ? (
        <div className="glass-panel p-12 text-center text-xs text-muted">Loading schedule...</div>
      ) : events.length === 0 ? (
        <div className="glass-panel p-16 text-center">
          <CalendarDays size={40} className="mx-auto text-violet-400/50 mb-3" />
          <p className="text-sm font-semibold text-silver">No upcoming events</p>
          <p className="text-xs text-muted mt-1">Create an event to organize your upcoming schedule.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((ev) => (
            <GlassPanel key={ev.id} className="p-5 flex flex-col justify-between hover:border-violet-400/30 transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                    Event
                  </span>
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="text-muted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3 className="text-base font-semibold text-silver">{ev.title}</h3>
                {ev.description && <p className="text-xs text-muted mt-1">{ev.description}</p>}

                <div className="space-y-1.5 mt-4 text-xs text-muted font-mono">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-violet-400" />
                    <span>
                      {new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-cyan-400" />
                      <span>{ev.location}</span>
                    </div>
                  )}
                  {ev.meetingLink && (
                    <div className="flex items-center gap-2">
                      <Video size={14} className="text-emerald-400" />
                      <a href={ev.meetingLink} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                        Join Meeting
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.04] text-[11px] text-muted">
                {new Date(ev.startTime).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      {/* ===== CREATE EVENT MODAL ===== */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-6 border border-violet-500/30 shadow-glow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-silver">Create Event</h3>
                <button onClick={() => setShowModal(false)} className="text-muted hover:text-lavender">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="label-tracked block mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Design Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                <div>
                  <label className="label-tracked block mb-1">Description</label>
                  <textarea
                    placeholder="Event notes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-tracked block mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-violet-400/50"
                    />
                  </div>
                  <div>
                    <label className="label-tracked block mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-violet-400/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="label-tracked block mb-1">Location or Link</label>
                  <input
                    type="text"
                    placeholder="Conference Room A or URL"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-muted hover:text-silver"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow"
                  >
                    Save Event
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
