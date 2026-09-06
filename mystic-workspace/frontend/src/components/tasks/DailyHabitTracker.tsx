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
  CalendarDays,
  Repeat,
  Layers
} from 'lucide-react'
import GlassPanel from '../dashboard/GlassPanel'

export type HabitScheduleType = 'EVERY_DAY' | 'SPECIFIC_DAY_OF_MONTH' | 'DATE_RANGE' | 'SPECIFIC_DATE'

export interface DailyHabit {
  id: string
  title: string
  emoji?: string
  createdAt: string
  scheduleType?: HabitScheduleType
  specificDayOfMonth?: number // e.g. 15 (every month on 15th)
  rangeStartDay?: number // e.g. 1
  rangeEndDay?: number // e.g. 15
  specificDate?: string // 'YYYY-MM-DD'
}

const DEFAULT_HABITS: DailyHabit[] = [
  { id: 'h1', title: 'Wake up at 05:00', emoji: '⏰', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h2', title: 'Gym & Workout', emoji: '🏋️', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h3', title: 'Reading & Learning', emoji: '📚', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h4', title: 'Deep Work Session', emoji: '🚀', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h5', title: 'Code Review & PRs', emoji: '💻', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h6', title: 'Day Planning & Tasks', emoji: '📝', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h7', title: 'Social Media Detox', emoji: '🌿', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
  { id: 'h8', title: 'Evening Journal & Retrospective', emoji: '🌙', scheduleType: 'EVERY_DAY', createdAt: new Date().toISOString() },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_ABBRS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DailyHabitTrackerProps {
  showEditHabitButton?: boolean
  isManageOpen?: boolean
  setIsManageOpen?: (open: boolean) => void
}

export default function DailyHabitTracker({
  showEditHabitButton = true,
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
  const [newScheduleType, setNewScheduleType] = useState<HabitScheduleType>('EVERY_DAY')
  const [newSpecificDayOfMonth, setNewSpecificDayOfMonth] = useState<number>(1)
  const [newRangeStartDay, setNewRangeStartDay] = useState<number>(1)
  const [newRangeEndDay, setNewRangeEndDay] = useState<number>(15)
  const [newSpecificDate, setNewSpecificDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // Edit Habit state in modal
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editScheduleType, setEditScheduleType] = useState<HabitScheduleType>('EVERY_DAY')
  const [editSpecificDayOfMonth, setEditSpecificDayOfMonth] = useState<number>(1)
  const [editRangeStartDay, setEditRangeStartDay] = useState<number>(1)
  const [editRangeEndDay, setEditRangeEndDay] = useState<number>(15)
  const [editSpecificDate, setEditSpecificDate] = useState<string>('')

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

  // Helper to determine if a habit applies on a specific day
  const isHabitActiveOnDay = (habit: DailyHabit, dayNum: number, dateKey: string) => {
    const sched = habit.scheduleType || 'EVERY_DAY'
    if (sched === 'EVERY_DAY') return true
    if (sched === 'SPECIFIC_DAY_OF_MONTH') {
      return (habit.specificDayOfMonth || 1) === dayNum
    }
    if (sched === 'DATE_RANGE') {
      const start = habit.rangeStartDay || 1
      const end = habit.rangeEndDay || totalDaysInMonth
      return dayNum >= start && dayNum <= end
    }
    if (sched === 'SPECIFIC_DATE') {
      return habit.specificDate === dateKey
    }
    return true
  }

  // Toggle checkbox state for habit on a specific dateKey (ONLY ALLOWED FOR TODAY)
  const handleToggleCheck = (habit: DailyHabit, day: (typeof daysArray)[0]) => {
    if (!isHabitActiveOnDay(habit, day.dayNum, day.dateKey)) return

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
        [habit.id]: !dayChecks[habit.id]
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
      scheduleType: newScheduleType,
      specificDayOfMonth: newScheduleType === 'SPECIFIC_DAY_OF_MONTH' ? Number(newSpecificDayOfMonth) : undefined,
      rangeStartDay: newScheduleType === 'DATE_RANGE' ? Number(newRangeStartDay) : undefined,
      rangeEndDay: newScheduleType === 'DATE_RANGE' ? Number(newRangeEndDay) : undefined,
      specificDate: newScheduleType === 'SPECIFIC_DATE' ? newSpecificDate : undefined,
      createdAt: new Date().toISOString()
    }
    setHabits((prev) => [...prev, newHabit])
    setNewTitle('')
    setNewEmoji('✨')
    setNewScheduleType('EVERY_DAY')
  }

  // Start editing habit
  const handleStartEdit = (habit: DailyHabit) => {
    setEditingId(habit.id)
    setEditTitle(habit.title)
    setEditEmoji(habit.emoji || '✨')
    setEditScheduleType(habit.scheduleType || 'EVERY_DAY')
    setEditSpecificDayOfMonth(habit.specificDayOfMonth || 1)
    setEditRangeStartDay(habit.rangeStartDay || 1)
    setEditRangeEndDay(habit.rangeEndDay || 15)
    setEditSpecificDate(habit.specificDate || '')
  }

  // Save edited habit
  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim()) return
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              title: editTitle.trim(),
              emoji: editEmoji.trim() || '✨',
              scheduleType: editScheduleType,
              specificDayOfMonth: editScheduleType === 'SPECIFIC_DAY_OF_MONTH' ? Number(editSpecificDayOfMonth) : undefined,
              rangeStartDay: editScheduleType === 'DATE_RANGE' ? Number(editRangeStartDay) : undefined,
              rangeEndDay: editScheduleType === 'DATE_RANGE' ? Number(editRangeEndDay) : undefined,
              specificDate: editScheduleType === 'SPECIFIC_DATE' ? editSpecificDate : undefined
            }
          : h
      )
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
  const todayDayNum = today.getDate()

  // Habits active today
  const activeHabitsToday = useMemo(() => {
    return habits.filter((h) => isHabitActiveOnDay(h, todayDayNum, todayDateKey))
  }, [habits, todayDayNum, todayDateKey])

  // Today completed count
  const todayCompletedCount = useMemo(() => {
    const todayMap = checkMap[todayDateKey] || {}
    return activeHabitsToday.filter((h) => todayMap[h.id]).length
  }, [checkMap, todayDateKey, activeHabitsToday])

  // Total completed habits in the whole month
  const monthTotalChecks = useMemo(() => {
    let count = 0
    daysArray.forEach((day) => {
      const dayMap = checkMap[day.dateKey] || {}
      habits.forEach((h) => {
        if (isHabitActiveOnDay(h, day.dayNum, day.dateKey) && dayMap[h.id]) {
          count++
        }
      })
    })
    return count
  }, [daysArray, checkMap, habits])

  // Total possible active checks in the month
  const totalPossibleChecks = useMemo(() => {
    let total = 0
    daysArray.forEach((day) => {
      habits.forEach((h) => {
        if (isHabitActiveOnDay(h, day.dayNum, day.dateKey)) {
          total++
        }
      })
    })
    return total
  }, [daysArray, habits])

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
                Daily habit consistency matrix in real time. Past & future dates are locked.
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
                <span className="text-xs text-muted">/ {activeHabitsToday.length}</span>
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

            {/* Edit Habits Button (Visible only in Daily Task mode, hidden in Daily Matrix view) */}
            {showEditHabitButton && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all"
              >
                <Settings2 size={16} />
                <span>Edit Habits</span>
              </motion.button>
            )}
          </div>
        </div>
      </GlassPanel>

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
                    No habits configured. Use "Daily Task" to add your recurring routines.
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
                    {/* Clean Habit Label Column */}
                    <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2.5 border-r border-white/[0.08]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate" title={habit.title}>
                          <span className="text-base flex-shrink-0">{habit.emoji || '✨'}</span>
                          <span className="text-xs font-medium text-silver truncate">
                            {habit.title}
                          </span>
                        </div>
                        {habit.scheduleType && habit.scheduleType !== 'EVERY_DAY' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono flex-shrink-0">
                            {habit.scheduleType === 'SPECIFIC_DAY_OF_MONTH'
                              ? `${habit.specificDayOfMonth}th`
                              : habit.scheduleType === 'DATE_RANGE'
                              ? `${habit.rangeStartDay}-${habit.rangeEndDay}`
                              : 'Single'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Checkbox Columns for each day */}
                    {daysArray.map((day) => {
                      const isActive = isHabitActiveOnDay(habit, day.dayNum, day.dateKey)
                      const isChecked = !!checkMap[day.dateKey]?.[habit.id]

                      if (!isActive) {
                        return (
                          <td
                            key={day.dateKey}
                            className="text-center p-1 border-r border-white/[0.02] opacity-20 select-none bg-black/10"
                          >
                            <span className="text-[11px] text-muted font-mono">—</span>
                          </td>
                        )
                      }

                      return (
                        <td
                          key={day.dateKey}
                          onClick={() => handleToggleCheck(habit, day)}
                          className={`text-center p-1 border-r border-white/[0.03] transition-colors select-none ${
                            day.isToday
                              ? 'bg-cyan-500/[0.08] cursor-pointer hover:bg-cyan-500/20'
                              : day.isPast
                              ? 'opacity-80 cursor-not-allowed bg-black/10'
                              : 'opacity-30 cursor-not-allowed bg-black/20'
                          }`}
                        >
                          <div className="flex items-center justify-center">
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
                    const activeHabitsForDay = habits.filter((h) => isHabitActiveOnDay(h, day.dayNum, day.dateKey))
                    const dayChecks = checkMap[day.dateKey] || {}
                    const done = activeHabitsForDay.filter((h) => dayChecks[h.id]).length
                    const pct = activeHabitsForDay.length > 0 ? Math.round((done / activeHabitsForDay.length) * 100) : 0
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
                    const activeHabitsForDay = habits.filter((h) => isHabitActiveOnDay(h, day.dayNum, day.dateKey))
                    const dayChecks = checkMap[day.dateKey] || {}
                    const done = activeHabitsForDay.filter((h) => dayChecks[h.id]).length
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
                    const activeHabitsForDay = habits.filter((h) => isHabitActiveOnDay(h, day.dayNum, day.dateKey))
                    const dayChecks = checkMap[day.dateKey] || {}
                    const done = activeHabitsForDay.filter((h) => dayChecks[h.id]).length
                    const notDone = activeHabitsForDay.length - done
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

      {/* ===== DAILY HABIT & TASK MANAGER MODAL (WITH SCHEDULING OPTIONS & RENAMING) ===== */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-2xl p-6 border border-cyan-500/30 shadow-glow relative max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-semibold text-silver">
                      Manage Daily Habits & Scheduled Tasks
                    </h3>
                    <p className="text-xs text-muted">
                      Add, rename, customize recurrence, or remove routines tracked in your Daily Matrix.
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

              {/* Add New Habit Section with Recurrence Options */}
              <form onSubmit={handleAddHabit} className="py-4 border-b border-white/[0.06] space-y-3">
                <div className="flex items-center gap-3">
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
                    <label className="text-[10px] text-muted block mb-1">New Routine / Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Morning 30-min Cardio, Budget Tracking..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-silver focus:outline-none focus:border-cyan-400 placeholder:text-muted/60"
                    />
                  </div>
                </div>

                {/* Schedule & Recurrence Picker */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="w-full sm:w-auto">
                    <label className="text-[10px] text-muted block mb-1">Schedule Frequency</label>
                    <select
                      value={newScheduleType}
                      onChange={(e) => setNewScheduleType(e.target.value as HabitScheduleType)}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    >
                      <option value="EVERY_DAY">Every Day (Daily)</option>
                      <option value="SPECIFIC_DAY_OF_MONTH">Specific Day in Every Month</option>
                      <option value="DATE_RANGE">Set of Continuous Days (Range)</option>
                      <option value="SPECIFIC_DATE">Single Specific Date</option>
                    </select>
                  </div>

                  {/* Frequency Custom Parameters */}
                  {newScheduleType === 'SPECIFIC_DAY_OF_MONTH' && (
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Day of Month (1-31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={newSpecificDayOfMonth}
                        onChange={(e) => setNewSpecificDayOfMonth(Number(e.target.value))}
                        className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  )}

                  {newScheduleType === 'DATE_RANGE' && (
                    <div className="flex items-center gap-2">
                      <div>
                        <label className="text-[10px] text-muted block mb-1">From Day</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={newRangeStartDay}
                          onChange={(e) => setNewRangeStartDay(Number(e.target.value))}
                          className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted block mb-1">To Day</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={newRangeEndDay}
                          onChange={(e) => setNewRangeEndDay(Number(e.target.value))}
                          className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  )}

                  {newScheduleType === 'SPECIFIC_DATE' && (
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Target Date</label>
                      <input
                        type="date"
                        value={newSpecificDate}
                        onChange={(e) => setNewSpecificDate(e.target.value)}
                        className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-silver focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="ml-auto mt-4 sm:mt-auto px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs shadow-glow flex items-center gap-1.5 hover:opacity-90 transition-all"
                  >
                    <Plus size={14} />
                    <span>Add Routine</span>
                  </button>
                </div>
              </form>

              {/* Habit List Management (Rename / Schedule Edit / Delete) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-2 pr-1">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">
                  Configured Routines ({habits.length})
                </span>

                {habits.length === 0 ? (
                  <p className="text-xs text-muted py-6 text-center">No habits added yet.</p>
                ) : (
                  habits.map((habit) => (
                    <div
                      key={habit.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/30 transition-all space-y-2"
                    >
                      {editingId === habit.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
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
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <select
                              value={editScheduleType}
                              onChange={(e) => setEditScheduleType(e.target.value as HabitScheduleType)}
                              className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-silver"
                            >
                              <option value="EVERY_DAY">Every Day</option>
                              <option value="SPECIFIC_DAY_OF_MONTH">Day of Month</option>
                              <option value="DATE_RANGE">Date Range</option>
                              <option value="SPECIFIC_DATE">Specific Date</option>
                            </select>

                            {editScheduleType === 'SPECIFIC_DAY_OF_MONTH' && (
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={editSpecificDayOfMonth}
                                onChange={(e) => setEditSpecificDayOfMonth(Number(e.target.value))}
                                className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-silver"
                              />
                            )}

                            {editScheduleType === 'DATE_RANGE' && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={editRangeStartDay}
                                  onChange={(e) => setEditRangeStartDay(Number(e.target.value))}
                                  className="w-14 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-silver"
                                />
                                <span className="text-muted">to</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={editRangeEndDay}
                                  onChange={(e) => setEditRangeEndDay(Number(e.target.value))}
                                  className="w-14 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-silver"
                                />
                              </div>
                            )}

                            {editScheduleType === 'SPECIFIC_DATE' && (
                              <input
                                type="date"
                                value={editSpecificDate}
                                onChange={(e) => setEditSpecificDate(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-silver"
                              />
                            )}

                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(habit.id)}
                                className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors font-medium flex items-center gap-1"
                              >
                                <Check size={13} /> Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 rounded-lg bg-white/10 text-muted hover:text-silver transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 truncate pr-3">
                            <span className="text-lg">{habit.emoji || '✨'}</span>
                            <div>
                              <span className="text-xs font-semibold text-silver block">
                                {habit.title}
                              </span>
                              <span className="text-[10px] text-muted">
                                {habit.scheduleType === 'SPECIFIC_DAY_OF_MONTH'
                                  ? `Repeats on ${habit.specificDayOfMonth}th of every month`
                                  : habit.scheduleType === 'DATE_RANGE'
                                  ? `Active from Day ${habit.rangeStartDay} to Day ${habit.rangeEndDay}`
                                  : habit.scheduleType === 'SPECIFIC_DATE'
                                  ? `Scheduled on ${habit.specificDate}`
                                  : 'Daily routine (All days)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(habit)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-cyan-300 transition-colors"
                              title="Rename / Edit schedule"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHabit(habit.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-rose-400 transition-colors"
                              title="Delete habit"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
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
