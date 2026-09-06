import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  RotateCcw,
  CheckSquare,
  Calendar as CalendarIcon,
  Flame,
  Award
} from 'lucide-react'
import GlassPanel from '../dashboard/GlassPanel'

export interface DailyHabit {
  id: string
  title: string
  emoji?: string
  createdAt: string
}

const DEFAULT_HABITS: DailyHabit[] = [
  { id: 'h1', title: 'Wake up at 05:00', emoji: '⏰', createdAt: new Date().toISOString() },
  { id: 'h2', title: 'Gym & Workout', emoji: '🏋️', createdAt: new Date().toISOString() },
  { id: 'h3', title: 'Reading & Learning', emoji: '📚', createdAt: new Date().toISOString() },
  { id: 'h4', title: 'Deep Work Session', emoji: '🚀', createdAt: new Date().toISOString() },
  { id: 'h5', title: 'Code Review & PRs', emoji: '💻', createdAt: new Date().toISOString() },
  { id: 'h6', title: 'Day Planning & Tasks', emoji: '📝', createdAt: new Date().toISOString() },
  { id: 'h7', title: 'Social Media Detox', emoji: '🌿', createdAt: new Date().toISOString() },
  { id: 'h8', title: 'Evening Journal & Retrospective', emoji: '🌙', createdAt: new Date().toISOString() },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_ABBRS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DailyHabitTrackerProps {
  onClose?: () => void
}

export default function DailyHabitTracker({ onClose }: DailyHabitTrackerProps) {
  // Navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Habits list state
  const [habits, setHabits] = useState<DailyHabit[]>(() => {
    try {
      const saved = localStorage.getItem('nova_daily_habits')
      return saved ? JSON.parse(saved) : DEFAULT_HABITS
    } catch {
      return DEFAULT_HABITS
    }
  })

  // Checks mapping: { [dateKey: 'YYYY-MM-DD']: { [habitId: string]: boolean } }
  const [checkMap, setCheckMap] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('nova_habit_checks')
      if (saved) return JSON.parse(saved)
      
      // Generate some realistic sample data for the current month so it looks alive out of the box
      const initialMap: Record<string, Record<string, boolean>> = {}
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth()
      const currentDay = today.getDate()

      for (let day = 1; day <= currentDay; day++) {
        const monthStr = String(month + 1).padStart(2, '0')
        const dayStr = String(day).padStart(2, '0')
        const dateKey = `${year}-${monthStr}-${dayStr}`
        initialMap[dateKey] = {}
        DEFAULT_HABITS.forEach((h, idx) => {
          // Semi-random deterministic check pattern based on day & index
          if ((day + idx) % 3 !== 0) {
            initialMap[dateKey][h.id] = true
          }
        })
      }
      return initialMap
    } catch {
      return {}
    }
  })

  // Add Habit Form
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('✨')

  // Edit Habit Form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editEmoji, setEditEmoji] = useState('')

  // Persist habits to localStorage
  useEffect(() => {
    localStorage.setItem('nova_daily_habits', JSON.stringify(habits))
  }, [habits])

  // Persist checkMap to localStorage
  useEffect(() => {
    localStorage.setItem('nova_habit_checks', JSON.stringify(checkMap))
  }, [checkMap])

  // Current year & month details
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

  // Generate array of days for current month: [1, 2, 3, ... totalDaysInMonth]
  const daysArray = useMemo(() => {
    return Array.from({ length: totalDaysInMonth }, (_, i) => {
      const dayNum = i + 1
      const dateObj = new Date(year, month, dayNum)
      const dayOfWeek = DAY_ABBRS[dateObj.getDay()]
      const monthStr = String(month + 1).padStart(2, '0')
      const dayStr = String(dayNum).padStart(2, '0')
      const dateKey = `${year}-${monthStr}-${dayStr}`
      const today = new Date()
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === dayNum

      return {
        dayNum,
        dayOfWeek,
        dateKey,
        isToday,
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6
      }
    })
  }, [year, month, totalDaysInMonth])

  // Group days into 7-day chunks (Week 1, Week 2, etc.)
  const weeks = useMemo(() => {
    const result: { weekIndex: number; days: typeof daysArray }[] = []
    let currentWeekDays: typeof daysArray = []
    let weekIndex = 1

    daysArray.forEach((day, idx) => {
      currentWeekDays.push(day)
      // Group by 7 days or end of month
      if (currentWeekDays.length === 7 || idx === daysArray.length - 1) {
        result.push({ weekIndex, days: currentWeekDays })
        weekIndex++
        currentWeekDays = []
      }
    })
    return result
  }, [daysArray])

  // Toggle checkbox state for habit on a specific dateKey
  const handleToggleCheck = (habitId: string, dateKey: string) => {
    setCheckMap((prev) => {
      const dayChecks = prev[dateKey] || {}
      const newDayChecks = {
        ...dayChecks,
        [habitId]: !dayChecks[habitId]
      }
      return {
        ...prev,
        [dateKey]: newDayChecks
      }
    })
  }

  // Add new habit
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const newHabit: DailyHabit = {
      id: 'h_' + Date.now(),
      title: newTitle.trim(),
      emoji: newEmoji.trim() || '✨',
      createdAt: new Date().toISOString()
    }
    setHabits((prev) => [...prev, newHabit])
    setNewTitle('')
    setNewEmoji('✨')
    setIsAdding(false)
  }

  // Start editing habit
  const handleStartEdit = (habit: DailyHabit) => {
    setEditingId(habit.id)
    setEditTitle(habit.title)
    setEditEmoji(habit.emoji || '✨')
  }

  // Save edited habit
  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim()) return
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, title: editTitle.trim(), emoji: editEmoji.trim() || '✨' } : h))
    )
    setEditingId(null)
  }

  // Delete habit
  const handleDeleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleGoToday = () => {
    setCurrentDate(new Date())
  }

  // Calculate statistics
  const todayObj = new Date()
  const todayMonthStr = String(todayObj.getMonth() + 1).padStart(2, '0')
  const todayDayStr = String(todayObj.getDate()).padStart(2, '0')
  const todayDateKey = `${todayObj.getFullYear()}-${todayMonthStr}-${todayDayStr}`

  // Today completed count
  const todayCompletedCount = useMemo(() => {
    const todayMap = checkMap[todayDateKey] || {}
    return habits.filter((h) => todayMap[h.id]).length
  }, [checkMap, todayDateKey, habits])

  // Total completed habits in the whole month
  const monthTotalChecks = useMemo(() => {
    let count = 0
    daysArray.forEach((day) => {
      const dayMap = checkMap[day.dateKey] || {}
      habits.forEach((h) => {
        if (dayMap[h.id]) count++
      })
    })
    return count
  }, [daysArray, checkMap, habits])

  // Total possible checks in the month
  const totalPossibleChecks = habits.length * totalDaysInMonth
  const overallMonthProgress = totalPossibleChecks > 0 ? Math.round((monthTotalChecks / totalPossibleChecks) * 100) : 0

  return (
    <div className="w-full space-y-6">
      {/* Top Header Card with Month & Progress Stats */}
      <GlassPanel className="p-5 md:p-6 border border-white/[0.08] shadow-glass relative overflow-hidden">
        {/* Ambient subtle glow background */}
        <div className="absolute top-0 right-1/4 w-96 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-72 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left: Month Title and Navigation */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-400/30 flex items-center justify-center text-cyan-300 shadow-glow">
              <CalendarIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl md:text-3xl font-display font-bold text-silver">
                  {MONTH_NAMES[month]} <span className="text-cyan-400 font-mono">{year}</span>
                </h2>
                <div className="flex items-center bg-white/[0.04] rounded-xl border border-white/[0.08] p-0.5">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted hover:text-silver transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted hover:text-silver transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  onClick={handleGoToday}
                  className="px-3 py-1 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all"
                >
                  Today
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                Daily habit consistency matrix and monthly task accountability tracker.
              </p>
            </div>
          </div>

          {/* Right: Metrics Badges & Progress Bar */}
          <div className="flex flex-wrap items-center gap-6 lg:gap-8">
            {/* Number of Habits */}
            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Number of Habits
              </span>
              <span className="text-2xl font-bold font-mono text-silver luminous-number">
                {habits.length}
              </span>
            </div>

            {/* Completed Habits Today */}
            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Today's Done
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-cyan-300 luminous-number">
                  {todayCompletedCount}
                </span>
                <span className="text-xs text-muted">/ {habits.length}</span>
              </div>
            </div>

            {/* Month Total Done */}
            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Month Total
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-300 luminous-number">
                {monthTotalChecks}
              </span>
            </div>

            {/* Overall Progress Bar */}
            <div className="min-w-[180px] flex-1 lg:flex-initial">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-muted uppercase tracking-wider text-[11px]">
                  Progress
                </span>
                <span className="font-mono font-bold text-cyan-300">{overallMonthProgress}%</span>
              </div>
              <div className="w-full h-3 bg-white/[0.04] rounded-full border border-white/[0.08] overflow-hidden p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallMonthProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500 shadow-glow"
                />
              </div>
            </div>

            {/* Add Habit Action */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAdding(true)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all"
            >
              <Plus size={16} />
              <span>Add Habit</span>
            </motion.button>
          </div>
        </div>
      </GlassPanel>

      {/* Inline Add Habit Modal / Drawer */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassPanel className="p-4 border border-violet-500/30 shadow-glow">
              <form onSubmit={handleAddHabit} className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-16">
                  <label className="text-[10px] text-muted block mb-1">Emoji</label>
                  <input
                    type="text"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    className="w-full text-center text-lg bg-white/[0.03] border border-white/[0.08] rounded-xl px-2 py-2 text-silver focus:outline-none focus:border-violet-400"
                    maxLength={3}
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[10px] text-muted block mb-1">Habit / Daily Task Title</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Morning 30-min Cardio, Code Review, No Sugar..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2.5 rounded-xl text-xs text-muted hover:text-silver bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow"
                  >
                    Save Habit
                  </button>
                </div>
              </form>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Habit Matrix Table */}
      <GlassPanel className="p-0 border border-white/[0.08] shadow-glass overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Top Row: Week Groupings */}
              <tr className="border-b border-white/[0.08] bg-white/[0.015]">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-void-950/95 backdrop-blur-md px-4 py-3 min-w-[220px] max-w-[260px] border-r border-white/[0.08] text-xs font-bold uppercase tracking-wider text-cyan-300"
                >
                  <div className="flex items-center justify-between">
                    <span>My Habits</span>
                    <span className="text-[10px] text-muted font-normal">({habits.length})</span>
                  </div>
                </th>
                {weeks.map((week) => (
                  <th
                    key={week.weekIndex}
                    colSpan={week.days.length}
                    className="text-center py-2 px-1 text-[11px] font-semibold tracking-wider text-purple-300/80 border-r border-white/[0.08] bg-white/[0.01]"
                  >
                    Week {week.weekIndex}
                  </th>
                ))}
              </tr>

              {/* Second Row: Day Names (Mo, Tu, We...) & Numbers (1, 2, 3...) */}
              <tr className="border-b border-white/[0.08] bg-white/[0.01]">
                {daysArray.map((day) => (
                  <th
                    key={day.dateKey}
                    className={`text-center px-1.5 py-2 min-w-[36px] max-w-[42px] border-r border-white/[0.04] transition-colors ${
                      day.isToday
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border-cyan-500/40'
                        : day.isWeekend
                        ? 'text-purple-400/60 bg-white/[0.005]'
                        : 'text-silver/70'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold">{day.dayOfWeek}</div>
                    <div
                      className={`text-xs font-mono font-bold mt-0.5 h-6 w-6 mx-auto rounded-full flex items-center justify-center ${
                        day.isToday ? 'bg-cyan-400 text-void-950 shadow-glow font-bold' : ''
                      }`}
                    >
                      {day.dayNum}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {habits.length === 0 ? (
                <tr>
                  <td colSpan={daysArray.length + 1} className="py-12 text-center text-xs text-muted">
                    No habits created yet. Click "+ Add Habit" to start tracking!
                  </td>
                </tr>
              ) : (
                habits.map((habit, hIdx) => (
                  <tr
                    key={habit.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group ${
                      hIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.005]'
                    }`}
                  >
                    {/* Sticky Habit Label Column */}
                    <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2.5 border-r border-white/[0.08]">
                      {editingId === habit.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editEmoji}
                            onChange={(e) => setEditEmoji(e.target.value)}
                            className="w-8 text-center text-sm bg-white/10 rounded px-1 py-0.5 text-silver"
                            maxLength={2}
                          />
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 text-xs bg-white/10 rounded px-2 py-0.5 text-silver focus:outline-none focus:border-cyan-400"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(habit.id)}
                            className="p-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group/row">
                          <div className="flex items-center gap-2 truncate pr-2" title={habit.title}>
                            <span className="text-base">{habit.emoji || '✨'}</span>
                            <span className="text-xs font-medium text-silver truncate">
                              {habit.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(habit)}
                              className="p-1 rounded hover:bg-white/10 text-muted hover:text-cyan-300 transition-colors"
                              title="Edit habit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteHabit(habit.id)}
                              className="p-1 rounded hover:bg-white/10 text-muted hover:text-rose-400 transition-colors"
                              title="Delete habit"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Checkbox Columns for each day */}
                    {daysArray.map((day) => {
                      const isChecked = !!checkMap[day.dateKey]?.[habit.id]
                      return (
                        <td
                          key={day.dateKey}
                          onClick={() => handleToggleCheck(habit.id, day.dateKey)}
                          className={`text-center p-1 border-r border-white/[0.03] cursor-pointer transition-colors ${
                            day.isToday
                              ? 'bg-cyan-500/[0.04]'
                              : isChecked
                              ? 'hover:bg-emerald-500/10'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                                isChecked
                                  ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 border-emerald-400 text-void-950 shadow-glow scale-105'
                                  : 'border-white/[0.15] bg-white/[0.02] hover:border-violet-400/60'
                              }`}
                              title={`${habit.title} on ${day.dayOfWeek}, ${day.dayNum} ${MONTH_NAMES[month]}`}
                            >
                              {isChecked && <Check size={13} strokeWidth={3.5} />}
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>

            {/* Bottom Summary Rows (Progress %, Done, Not Done) */}
            {habits.length > 0 && (
              <tfoot className="border-t-2 border-white/[0.08] bg-white/[0.02]">
                {/* 1. Progress % Row */}
                <tr className="border-b border-white/[0.04]">
                  <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2 border-r border-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                    Progress
                  </td>
                  {daysArray.map((day) => {
                    const dayChecks = checkMap[day.dateKey] || {}
                    const done = habits.filter((h) => dayChecks[h.id]).length
                    const pct = habits.length > 0 ? Math.round((done / habits.length) * 100) : 0
                    return (
                      <td
                        key={day.dateKey}
                        className={`text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono font-bold ${
                          pct === 100
                            ? 'text-emerald-400'
                            : pct >= 70
                            ? 'text-cyan-300'
                            : pct > 0
                            ? 'text-purple-300'
                            : 'text-muted/40'
                        } ${day.isToday ? 'bg-cyan-500/[0.08]' : ''}`}
                      >
                        {pct}%
                      </td>
                    )
                  })}
                </tr>

                {/* 2. Done Count Row */}
                <tr className="border-b border-white/[0.04]">
                  <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2 border-r border-white/[0.08] text-[11px] font-semibold text-emerald-400">
                    Done
                  </td>
                  {daysArray.map((day) => {
                    const dayChecks = checkMap[day.dateKey] || {}
                    const done = habits.filter((h) => dayChecks[h.id]).length
                    return (
                      <td
                        key={day.dateKey}
                        className={`text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono font-bold ${
                          done > 0 ? 'text-emerald-400' : 'text-muted/40'
                        } ${day.isToday ? 'bg-cyan-500/[0.08]' : ''}`}
                      >
                        {done}
                      </td>
                    )
                  })}
                </tr>

                {/* 3. Not Done Count Row */}
                <tr>
                  <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2 border-r border-white/[0.08] text-[11px] font-semibold text-rose-400/80">
                    Not Done
                  </td>
                  {daysArray.map((day) => {
                    const dayChecks = checkMap[day.dateKey] || {}
                    const done = habits.filter((h) => dayChecks[h.id]).length
                    const notDone = habits.length - done
                    return (
                      <td
                        key={day.dateKey}
                        className={`text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono font-medium ${
                          notDone === 0 ? 'text-muted/30' : 'text-rose-400/80'
                        } ${day.isToday ? 'bg-cyan-500/[0.08]' : ''}`}
                      >
                        {notDone}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}
