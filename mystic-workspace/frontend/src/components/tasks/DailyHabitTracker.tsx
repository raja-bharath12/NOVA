import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Check,
  Calendar as CalendarIcon,
  Lock,
  X,
  Settings2,
  Sparkles,
  CheckCircle2,
  Flame
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
  isManageOpen?: boolean
  setIsManageOpen?: (open: boolean) => void
}

export default function DailyHabitTracker({
  isManageOpen = false,
  setIsManageOpen
}: DailyHabitTrackerProps) {
  // Navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Internal modal state fallback if not controlled from parent
  const [internalManageOpen, setInternalManageOpen] = useState(false)
  const isModalOpen = setIsManageOpen ? isManageOpen : internalManageOpen
  const setModalOpen = setIsManageOpen || setInternalManageOpen

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

      // Initialize past days with realistic sample check-ins
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

  // Add Habit Form state in modal
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('✨')

  // Edit Habit state in modal
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editEmoji, setEditEmoji] = useState('')

  // Toast notice for locked dates
  const [lockedNotice, setLockedNotice] = useState<string | null>(null)

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

  // Midnight today reference for strict comparison
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  // Generate array of days for current month with strict date locking
  const daysArray = useMemo(() => {
    return Array.from({ length: totalDaysInMonth }, (_, i) => {
      const dayNum = i + 1
      const dateObj = new Date(year, month, dayNum)
      const dayMidnight = new Date(year, month, dayNum).getTime()
      const dayOfWeek = DAY_ABBRS[dateObj.getDay()]
      const monthStr = String(month + 1).padStart(2, '0')
      const dayStr = String(dayNum).padStart(2, '0')
      const dateKey = `${year}-${monthStr}-${dayStr}`

      const isToday = dayMidnight === todayMidnight
      const isPast = dayMidnight < todayMidnight
      const isFuture = dayMidnight > todayMidnight
      const isLocked = isPast || isFuture

      return {
        dayNum,
        dayOfWeek,
        dateKey,
        isToday,
        isPast,
        isFuture,
        isLocked,
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6
      }
    })
  }, [year, month, totalDaysInMonth, todayMidnight])

  // Group days into 7-day chunks (Week 1, Week 2, etc.)
  const weeks = useMemo(() => {
    const result: { weekIndex: number; days: typeof daysArray }[] = []
    let currentWeekDays: typeof daysArray = []
    let weekIndex = 1

    daysArray.forEach((day, idx) => {
      currentWeekDays.push(day)
      if (currentWeekDays.length === 7 || idx === daysArray.length - 1) {
        result.push({ weekIndex, days: currentWeekDays })
        weekIndex++
        currentWeekDays = []
      }
    })
    return result
  }, [daysArray])

  // Toggle checkbox state for habit on a specific dateKey (ONLY ALLOWED FOR TODAY)
  const handleToggleCheck = (habitId: string, day: (typeof daysArray)[0]) => {
    if (day.isLocked) {
      const reason = day.isFuture ? 'Future dates are locked.' : 'Past dates are locked records.'
      setLockedNotice(reason)
      setTimeout(() => setLockedNotice(null), 2500)
      return
    }

    setCheckMap((prev) => {
      const dayChecks = prev[day.dateKey] || {}
      const newDayChecks = {
        ...dayChecks,
        [habitId]: !dayChecks[habitId]
      }
      return {
        ...prev,
        [day.dateKey]: newDayChecks
      }
    })
  }

  // Add new habit (within modal)
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

  // Statistics
  const todayMonthStr = String(today.getMonth() + 1).padStart(2, '0')
  const todayDayStr = String(today.getDate()).padStart(2, '0')
  const todayDateKey = `${today.getFullYear()}-${todayMonthStr}-${todayDayStr}`

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
      {/* Locked Date Floating Alert */}
      <AnimatePresence>
        {lockedNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-50 flex items-center gap-2 bg-void-950/90 border border-cyan-400/40 px-4 py-2.5 rounded-xl shadow-glow text-xs text-silver backdrop-blur-md"
          >
            <Lock size={14} className="text-cyan-400" />
            <span>{lockedNotice} Real-time check-ins are active for Today.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card with Month & Progress Stats */}
      <GlassPanel className="p-5 md:p-6 border border-white/[0.08] shadow-glass relative overflow-hidden">
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
                Daily matrix records habit consistency in real time. Past & future dates are locked.
              </p>
            </div>
          </div>

          {/* Right: Metrics Badges & Progress Bar */}
          <div className="flex flex-wrap items-center gap-6 lg:gap-8">
            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Number of Habits
              </span>
              <span className="text-2xl font-bold font-mono text-silver luminous-number">
                {habits.length}
              </span>
            </div>

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

            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Month Total
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-300 luminous-number">
                {monthTotalChecks}
              </span>
            </div>

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

            {/* Manage Habits Trigger Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setModalOpen(true)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all"
            >
              <Settings2 size={16} />
              <span>Edit Habits</span>
            </motion.button>
          </div>
        </div>
      </GlassPanel>

      {/* Main Habit Matrix Table (CLEAN VIEW-ONLY HABIT COLUMN, INTERACTIVE TODAY COLUMN) */}
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
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border-cyan-500/40 shadow-glow'
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
                    No habits added yet. Click "Edit Habits" to configure your daily routines!
                  </td>
                </tr>
              ) : (
                habits.map((habit, hIdx) => (
                  <tr
                    key={habit.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                      hIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.005]'
                    }`}
                  >
                    {/* Clean Habit Label Column (No in-cell editing, managed via Daily Task modal) */}
                    <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2.5 border-r border-white/[0.08]">
                      <div className="flex items-center gap-2 truncate" title={habit.title}>
                        <span className="text-base flex-shrink-0">{habit.emoji || '✨'}</span>
                        <span className="text-xs font-medium text-silver truncate">
                          {habit.title}
                        </span>
                      </div>
                    </td>

                    {/* Checkbox Columns for each day (Today: Real-time interactive, Past/Future: Locked) */}
                    {daysArray.map((day) => {
                      const isChecked = !!checkMap[day.dateKey]?.[habit.id]
                      return (
                        <td
                          key={day.dateKey}
                          onClick={() => handleToggleCheck(habit.id, day)}
                          className={`text-center p-1 border-r border-white/[0.03] transition-colors select-none ${
                            day.isToday
                              ? 'bg-cyan-500/[0.08] cursor-pointer hover:bg-cyan-500/20'
                              : day.isPast
                              ? 'opacity-80 cursor-not-allowed bg-black/10'
                              : 'opacity-30 cursor-not-allowed bg-black/20'
                          }`}
                        >
                          <div className="flex items-center justify-center relative group/cell">
                            <button
                              type="button"
                              disabled={day.isLocked}
                              className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                                isChecked
                                  ? day.isToday
                                    ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 border-emerald-400 text-void-950 shadow-glow scale-105'
                                    : 'bg-emerald-500/40 border-emerald-500/50 text-emerald-300'
                                  : day.isToday
                                  ? 'border-cyan-400/60 bg-white/[0.03] hover:border-cyan-300 shadow-glow'
                                  : 'border-white/[0.08] bg-transparent'
                              }`}
                              title={
                                day.isToday
                                  ? `Click to toggle ${habit.title} for Today`
                                  : day.isPast
                                  ? `${habit.title} on ${day.dayNum} ${MONTH_NAMES[month]} (Past record locked)`
                                  : `${habit.title} on ${day.dayNum} ${MONTH_NAMES[month]} (Future date locked)`
                              }
                            >
                              {isChecked ? (
                                <Check size={13} strokeWidth={3.5} />
                              ) : day.isLocked ? (
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                              ) : null}
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
                            : 'text-muted/30'
                        } ${day.isToday ? 'bg-cyan-500/[0.12] text-cyan-300 font-extrabold' : ''}`}
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
                          done > 0 ? 'text-emerald-400' : 'text-muted/30'
                        } ${day.isToday ? 'bg-cyan-500/[0.12]' : ''}`}
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
                          notDone === 0 ? 'text-muted/20' : 'text-rose-400/80'
                        } ${day.isToday ? 'bg-cyan-500/[0.12]' : ''}`}
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

      {/* ===== DAILY HABIT & TASK MANAGER MODAL ===== */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-xl p-6 border border-cyan-500/30 shadow-glow relative max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-semibold text-silver">
                      Manage Daily Habits & Tasks
                    </h3>
                    <p className="text-xs text-muted">
                      Add, edit, or remove recurring habits tracked in your real-time Daily Matrix.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Add New Habit Section */}
              <form onSubmit={handleAddHabit} className="py-4 border-b border-white/[0.06] flex items-center gap-3">
                <div className="w-14">
                  <label className="text-[10px] text-muted block mb-1">Emoji</label>
                  <input
                    type="text"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    className="w-full text-center text-base bg-white/[0.03] border border-white/[0.08] rounded-xl px-1 py-2 text-silver focus:outline-none focus:border-cyan-400"
                    maxLength={3}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted block mb-1">New Habit / Daily Routine</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Morning 30-min Cardio, Code Review..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-silver focus:outline-none focus:border-cyan-400 placeholder:text-muted/60"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs shadow-glow flex items-center gap-1.5 self-end hover:opacity-90 transition-all"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </form>

              {/* Habit List Management (Edit / Delete) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-2 pr-1">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">
                  Existing Habits ({habits.length})
                </span>

                {habits.length === 0 ? (
                  <p className="text-xs text-muted py-6 text-center">No habits added yet.</p>
                ) : (
                  habits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/30 transition-all"
                    >
                      {editingId === habit.id ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={editEmoji}
                            onChange={(e) => setEditEmoji(e.target.value)}
                            className="w-10 text-center text-sm bg-white/10 rounded-lg px-1 py-1 text-silver border border-white/20"
                            maxLength={3}
                          />
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 text-xs bg-white/10 rounded-lg px-3 py-1.5 text-silver focus:outline-none focus:border-cyan-400 border border-white/20"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(habit.id)}
                            className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                            title="Save changes"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-white/10 text-muted hover:text-silver transition-colors"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 truncate pr-3">
                            <span className="text-lg">{habit.emoji || '✨'}</span>
                            <span className="text-xs font-medium text-silver truncate">
                              {habit.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(habit)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-cyan-300 transition-colors"
                              title="Edit habit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHabit(habit.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-rose-400 transition-colors"
                              title="Delete habit"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-white/[0.06] flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-silver font-medium text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
