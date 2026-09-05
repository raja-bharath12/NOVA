import React, { useEffect, useState, useMemo } from 'react'
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
  Calendar as CalendarIcon,
  List,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { eventService } from '../services/eventService'
import type { EventItem } from '../types'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  // Real-Time Calendar Navigation State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month')

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

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    )
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  // Quick Open Modal with prefilled date
  const openCreateModalForDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const startStr = `${year}-${month}-${day}T09:00`
    const endStr = `${year}-${month}-${day}T10:00`
    setStartTime(startStr)
    setEndTime(endStr)
    setShowModal(true)
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

  // Compute Calendar Grid Days (6 rows x 7 cols = 42 cells)
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDaysCurrentMonth = new Date(year, month + 1, 0).getDate()
    const totalDaysPrevMonth = new Date(year, month, 0).getDate()

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []
    const today = new Date()

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, totalDaysPrevMonth - i)
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: d.toDateString() === today.toDateString(),
      })
    }

    // Current month days
    for (let d = 1; d <= totalDaysCurrentMonth; d++) {
      const dateObj = new Date(year, month, d)
      days.push({
        date: dateObj,
        isCurrentMonth: true,
        isToday: dateObj.toDateString() === today.toDateString(),
      })
    }

    // Next month padding to fill 42 cells or full 5/6 weeks
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(year, month + 1, d)
      days.push({
        date: dateObj,
        isCurrentMonth: false,
        isToday: dateObj.toDateString() === today.toDateString(),
      })
    }

    return days
  }, [currentMonthDate])

  // Map events for each calendar day
  const getEventsForDate = (date: Date) => {
    return events.filter((ev) => {
      const evDate = new Date(ev.startTime)
      return (
        evDate.getFullYear() === date.getFullYear() &&
        evDate.getMonth() === date.getMonth() &&
        evDate.getDate() === date.getDate()
      )
    })
  }

  // Filter events for the currently selected day
  const selectedDayEvents = useMemo(() => {
    return getEventsForDate(selectedDate).sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
  }, [selectedDate, events])

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Interactive Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-gradient">
            Schedule & Events
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1">
            Real-time interactive workspace schedule, team meetings, and sprint timelines.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'month'
                  ? 'bg-violet-600/30 text-silver border border-violet-500/30 shadow-glow'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <CalendarIcon size={14} />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'agenda'
                  ? 'bg-violet-600/30 text-silver border border-violet-500/30 shadow-glow'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <List size={14} />
              <span>Agenda</span>
            </button>
          </div>

          {/* New Event Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openCreateModalForDate(selectedDate)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all"
          >
            <Plus size={16} />
            <span>New Event</span>
          </motion.button>
        </div>
      </div>

      {/* Real-time Month Navigation Bar */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-display font-bold text-silver">
              {MONTH_NAMES[currentMonthDate.getMonth()]}{' '}
              <span className="text-cyan-400">{currentMonthDate.getFullYear()}</span>
            </h2>
            <p className="text-[11px] text-muted">
              {events.length} total event{events.length === 1 ? '' : 's'} scheduled
            </p>
          </div>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-silver border border-white/[0.08] transition-all hover:border-violet-400/40"
          >
            Today
          </button>
          <div className="flex items-center bg-white/[0.04] rounded-xl border border-white/[0.08] p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-white/[0.08] text-muted hover:text-silver transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-[1px] h-4 bg-white/[0.08]" />
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-white/[0.08] text-muted hover:text-silver transition-colors"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport: Month Grid or Agenda List */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Month Calendar Grid (3 columns on large screens) */}
          <div className="lg:col-span-3 glass-panel p-4 md:p-6 overflow-hidden flex flex-col">
            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAY_NAMES.map((d, i) => (
                <div
                  key={d}
                  className={`text-center py-2 text-xs font-semibold uppercase tracking-wider ${
                    i === 0 || i === 6 ? 'text-purple-400/70' : 'text-silver/60'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr min-h-[540px]">
              {calendarDays.map((dayObj, index) => {
                const dayEvents = getEventsForDate(dayObj.date)
                const isSelected =
                  dayObj.date.toDateString() === selectedDate.toDateString()

                return (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDate(dayObj.date)}
                    className={`relative p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group min-h-[90px] ${
                      isSelected
                        ? 'bg-violet-600/20 border-violet-400 shadow-glow'
                        : dayObj.isToday
                        ? 'bg-cyan-500/10 border-cyan-400/50'
                        : dayObj.isCurrentMonth
                        ? 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05]'
                        : 'bg-white/[0.008] border-transparent opacity-40 hover:opacity-75'
                    }`}
                  >
                    {/* Date Number & Quick Add Button */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold rounded-full h-6 w-6 flex items-center justify-center ${
                          dayObj.isToday
                            ? 'bg-cyan-400 text-void-950 font-bold shadow-glow'
                            : isSelected
                            ? 'bg-violet-400 text-void-950 font-bold'
                            : dayObj.isCurrentMonth
                            ? 'text-silver'
                            : 'text-muted'
                        }`}
                      >
                        {dayObj.date.getDate()}
                      </span>

                      {/* Quick Add Hover Icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openCreateModalForDate(dayObj.date)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/10 text-muted hover:text-cyan-400 transition-opacity"
                        title="Add event on this date"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Day Events Indicator Chips */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className="truncate text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/30 text-silver font-medium hover:border-cyan-400 transition-colors"
                          title={ev.title}
                        >
                          <span className="text-cyan-400 font-mono mr-1">
                            {new Date(ev.startTime).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-muted block text-right font-medium">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Selected Day Agenda Sidebar (1 column) */}
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
                <div>
                  <span className="label-tracked block">Selected Date</span>
                  <h3 className="text-base font-semibold text-silver">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h3>
                </div>
                <button
                  onClick={() => openCreateModalForDate(selectedDate)}
                  className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all"
                  title="Add event for selected day"
                >
                  <Plus size={14} />
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays size={32} className="mx-auto text-muted/40 mb-2" />
                  <p className="text-xs text-muted">No events for this day.</p>
                  <button
                    onClick={() => openCreateModalForDate(selectedDate)}
                    className="mt-3 text-xs text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <Plus size={12} /> Schedule an Event
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-violet-400/30 transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-silver line-clamp-1">
                          {ev.title}
                        </h4>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-400 transition-all p-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {ev.description && (
                        <p className="text-[11px] text-muted line-clamp-2">
                          {ev.description}
                        </p>
                      )}

                      <div className="text-[10px] text-muted/80 space-y-1 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-violet-400" />
                          <span>
                            {new Date(ev.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            -{' '}
                            {new Date(ev.endTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-cyan-400" />
                            <span className="truncate">{ev.location}</span>
                          </div>
                        )}
                        {ev.meetingLink && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Video size={11} className="text-emerald-400" />
                            <a
                              href={ev.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline font-sans"
                            >
                              Join Meeting
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      ) : (
        /* Agenda / Timeline View */
        <div className="space-y-4">
          {loading ? (
            <div className="glass-panel p-12 text-center text-xs text-muted">
              Loading schedule...
            </div>
          ) : events.length === 0 ? (
            <div className="glass-panel p-16 text-center">
              <CalendarDays size={40} className="mx-auto text-violet-400/50 mb-3" />
              <p className="text-sm font-semibold text-silver">No upcoming events</p>
              <p className="text-xs text-muted mt-1">
                Create an event to organize your upcoming schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev) => (
                <GlassPanel
                  key={ev.id}
                  className="p-5 flex flex-col justify-between hover:border-violet-400/30 transition-all"
                >
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
                    {ev.description && (
                      <p className="text-xs text-muted mt-1">{ev.description}</p>
                    )}

                    <div className="space-y-1.5 mt-4 text-xs text-muted font-mono">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-violet-400" />
                        <span>
                          {new Date(ev.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(ev.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
                          <a
                            href={ev.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline"
                          >
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
                <h3 className="text-lg font-display font-semibold text-silver">
                  Create Event
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted hover:text-lavender"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="label-tracked block mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sprint Planning Sync"
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
