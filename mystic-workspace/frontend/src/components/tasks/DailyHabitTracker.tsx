import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Calendar as CalendarIcon,
  Lock,
  X,
  Settings2,
  Sparkles,
  Play,
  Flame,
  CheckCircle2
} from 'lucide-react'
import GlassPanel from '../dashboard/GlassPanel'
import type { Task, Priority } from '../../types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_ABBRS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DailyHabitTrackerProps {
  tasks: Task[]
  onToggleTask: (id: number) => Promise<void> | void
  onCreateTask: (task: Partial<Task>) => Promise<void> | void
  onDeleteTask: (id: number) => Promise<void> | void
  showEditHabitButton?: boolean
  isManageOpen?: boolean
  setIsManageOpen?: (open: boolean) => void
  onOpenTutorial?: () => void
}

export default function DailyHabitTracker({
  tasks,
  onToggleTask,
  onCreateTask,
  onDeleteTask,
  showEditHabitButton = true,
  isManageOpen = false,
  setIsManageOpen,
  onOpenTutorial
}: DailyHabitTrackerProps) {
  // Navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Internal modal state fallback if not controlled from parent
  const [internalManageOpen, setInternalManageOpen] = useState(false)
  const isModalOpen = setIsManageOpen ? isManageOpen : internalManageOpen
  const setModalOpen = setIsManageOpen || setInternalManageOpen

  // Add Task/Habit form state in modal
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('MEDIUM')
  const [newCategory, setNewCategory] = useState('Work')
  const [newDeadline, setNewDeadline] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Toast notice for locked dates
  const [lockedNotice, setLockedNotice] = useState<string | null>(null)

  // Current year & month details
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

  // Midnight today reference for strict date comparisons
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
        dayMidnight,
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

  // Helper to determine if a task existed on or before a given day based on real database timestamps
  const getTaskCreationMidnight = (task: Task): number => {
    if (task.createdAt) {
      const d = new Date(task.createdAt)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    }
    // Fallback if createdAt not present: consider created today
    return todayMidnight
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

  // Handle task toggle on Today
  const handleCellClick = (task: Task, day: (typeof daysArray)[0]) => {
    const taskCreatedMidnight = getTaskCreationMidnight(task)
    if (day.dayMidnight < taskCreatedMidnight) {
      setLockedNotice('No record. Task was not created on this date.')
      setTimeout(() => setLockedNotice(null), 2500)
      return
    }

    if (day.isLocked) {
      const reason = day.isFuture ? 'Future dates are locked.' : 'Historical records are locked.'
      setLockedNotice(reason)
      setTimeout(() => setLockedNotice(null), 2500)
      return
    }

    if (task.id) {
      onToggleTask(task.id)
    }
  }

  // Add new task / habit in modal
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    await onCreateTask({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      priority: newPriority,
      category: newCategory.trim() || 'Work',
      deadline: newDeadline || undefined,
      completed: false
    })

    setNewTitle('')
    setNewDescription('')
    setNewPriority('MEDIUM')
    setNewDeadline('')
    setModalOpen(false)
  }

  // Statistics calculation from REAL DATA ONLY
  const activeTasksToday = useMemo(() => {
    return tasks.filter((t) => getTaskCreationMidnight(t) <= todayMidnight)
  }, [tasks, todayMidnight])

  const todayCompletedCount = useMemo(() => {
    return activeTasksToday.filter((t) => t.completed).length
  }, [activeTasksToday])

  const monthTotalCompleted = useMemo(() => {
    return tasks.filter((t) => t.completed).length
  }, [tasks])

  const overallProgress =
    tasks.length > 0 ? Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100) : 0

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

      {/* Top Header Card with Month & Real Progress Stats */}
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
                Real-time habit consistency matrix. Only real database tasks and active check-ins are tracked.
              </p>
            </div>
          </div>

          {/* Right: Real Metrics Badges & Progress Bar */}
          <div className="flex flex-wrap items-center gap-6 lg:gap-8">
            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Total Tasks
              </span>
              <span className="text-2xl font-bold font-mono text-silver luminous-number">
                {tasks.length}
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
                <span className="text-xs text-muted">/ {activeTasksToday.length}</span>
              </div>
            </div>

            <div className="text-center lg:text-left">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Completed
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-300 luminous-number">
                {monthTotalCompleted}
              </span>
            </div>

            <div className="min-w-[180px] flex-1 lg:flex-initial">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-muted uppercase tracking-wider text-[11px]">
                  Real Progress
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  {tasks.length === 0 ? '0%' : `${overallProgress}%`}
                </span>
              </div>
              <div className="w-full h-3 bg-white/[0.04] rounded-full border border-white/[0.08] overflow-hidden p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500 shadow-glow"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onOpenTutorial && (
                <button
                  onClick={onOpenTutorial}
                  className="h-10 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-silver border border-white/[0.1] font-semibold text-xs flex items-center gap-1.5 transition-all"
                  title="Watch Video Tutorial"
                >
                  <Play size={14} className="text-cyan-400 fill-current" />
                  <span className="hidden sm:inline">Tutorial</span>
                </button>
              )}

              {showEditHabitButton && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setModalOpen(true)}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all"
                >
                  <Plus size={16} />
                  <span>Add Task</span>
                </motion.button>
              )}
            </div>
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
                  className="sticky left-0 z-20 bg-void-950/95 backdrop-blur-md px-4 py-3 min-w-[220px] max-w-[280px] border-r border-white/[0.08] text-xs font-bold uppercase tracking-wider text-cyan-300"
                >
                  <div className="flex items-center justify-between">
                    <span>Active Tasks</span>
                    <span className="text-[10px] text-muted font-normal font-mono">({tasks.length})</span>
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
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={daysArray.length + 1} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3 px-4">
                      <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 mx-auto flex items-center justify-center text-cyan-400 shadow-glow">
                        <Sparkles size={22} />
                      </div>
                      <h3 className="text-base font-display font-semibold text-silver">
                        Welcome to your NOVA workspace
                      </h3>
                      <p className="text-xs text-muted leading-relaxed">
                        You don't have any tasks yet. Create your first task to start tracking your real-world productivity.
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        {onOpenTutorial && (
                          <button
                            onClick={onOpenTutorial}
                            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-silver text-xs font-medium transition-all flex items-center gap-1.5"
                          >
                            <Play size={13} className="text-cyan-400 fill-current" />
                            <span>Watch Tutorial</span>
                          </button>
                        )}
                        <button
                          onClick={() => setModalOpen(true)}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs shadow-glow flex items-center gap-1.5 hover:opacity-90 transition-all"
                        >
                          <Plus size={14} />
                          <span>+ Create Task</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map((task, tIdx) => {
                  const taskCreatedMidnight = getTaskCreationMidnight(task)

                  return (
                    <tr
                      key={task.id || tIdx}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                        tIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.005]'
                      }`}
                    >
                      {/* Task Label Column */}
                      <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2.5 border-r border-white/[0.08]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate" title={task.title}>
                            <span className="text-xs font-medium text-silver truncate">
                              {task.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {task.category && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-muted font-mono">
                                {task.category}
                              </span>
                            )}
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                task.priority === 'HIGH'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : task.priority === 'LOW'
                                  ? 'bg-white/[0.04] text-muted'
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Day Columns */}
                      {daysArray.map((day) => {
                        const isPriorToCreation = day.dayMidnight < taskCreatedMidnight
                        const isFutureDate = day.dayMidnight > todayMidnight

                        // If day is before task creation: strictly NO DATA ("—")
                        if (isPriorToCreation) {
                          return (
                            <td
                              key={day.dateKey}
                              className="text-center p-1 border-r border-white/[0.02] opacity-25 select-none bg-black/10"
                              title="Task did not exist on this date"
                            >
                              <span className="text-[11px] text-muted font-mono">—</span>
                            </td>
                          )
                        }

                        // If day is in future: locked ("—")
                        if (isFutureDate) {
                          return (
                            <td
                              key={day.dateKey}
                              className="text-center p-1 border-r border-white/[0.02] opacity-25 select-none bg-black/20"
                              title="Future date locked"
                            >
                              <span className="text-[11px] text-muted font-mono">—</span>
                            </td>
                          )
                        }

                        // Day is valid: either completed (✓) or active pending (○)
                        const isChecked = task.completed

                        return (
                          <td
                            key={day.dateKey}
                            onClick={() => handleCellClick(task, day)}
                            className={`text-center p-1 border-r border-white/[0.03] transition-colors select-none ${
                              day.isToday
                                ? 'bg-cyan-500/[0.08] cursor-pointer hover:bg-cyan-500/20'
                                : 'opacity-80 cursor-not-allowed bg-black/10'
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
                                      : 'bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
                                    : day.isToday
                                    ? 'border-cyan-400/60 bg-white/[0.03] hover:border-cyan-300 shadow-glow'
                                    : 'border-white/[0.08] bg-transparent'
                                }`}
                                title={
                                  day.isToday
                                    ? `Click to toggle "${task.title}" for Today`
                                    : isChecked
                                    ? `"${task.title}" completed`
                                    : `"${task.title}" pending on ${day.dayNum} ${MONTH_NAMES[month]}`
                                }
                              >
                                {isChecked ? (
                                  <Check size={13} strokeWidth={3.5} />
                                ) : day.isToday ? null : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                )}
                              </button>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Bottom Summary Rows (Progress %, Done, Not Done) from REAL DATA */}
            {tasks.length > 0 && (
              <tfoot className="border-t-2 border-white/[0.08] bg-white/[0.02]">
                {/* 1. Progress % Row */}
                <tr className="border-b border-white/[0.04]">
                  <td className="sticky left-0 z-10 bg-void-950/95 backdrop-blur-md px-4 py-2 border-r border-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                    Progress
                  </td>
                  {daysArray.map((day) => {
                    const activeTasksForDay = tasks.filter(
                      (t) => getTaskCreationMidnight(t) <= day.dayMidnight && day.dayMidnight <= todayMidnight
                    )
                    const done = activeTasksForDay.filter((t) => t.completed).length
                    const pct = activeTasksForDay.length > 0 ? Math.round((done / activeTasksForDay.length) * 100) : 0

                    if (activeTasksForDay.length === 0 || day.dayMidnight > todayMidnight) {
                      return (
                        <td
                          key={day.dateKey}
                          className="text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono text-muted/30"
                        >
                          —
                        </td>
                      )
                    }

                    return (
                      <td
                        key={day.dateKey}
                        className={`text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono font-bold ${
                          pct === 100
                            ? 'text-emerald-400'
                            : pct >= 50
                            ? 'text-cyan-300'
                            : 'text-purple-300'
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
                    const activeTasksForDay = tasks.filter(
                      (t) => getTaskCreationMidnight(t) <= day.dayMidnight && day.dayMidnight <= todayMidnight
                    )
                    const done = activeTasksForDay.filter((t) => t.completed).length

                    if (activeTasksForDay.length === 0 || day.dayMidnight > todayMidnight) {
                      return (
                        <td
                          key={day.dateKey}
                          className="text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono text-muted/30"
                        >
                          —
                        </td>
                      )
                    }

                    return (
                      <td
                        key={day.dateKey}
                        className={`text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono font-bold ${
                          done > 0 ? 'text-emerald-400' : 'text-muted/40'
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
                    Pending
                  </td>
                  {daysArray.map((day) => {
                    const activeTasksForDay = tasks.filter(
                      (t) => getTaskCreationMidnight(t) <= day.dayMidnight && day.dayMidnight <= todayMidnight
                    )
                    const done = activeTasksForDay.filter((t) => t.completed).length
                    const notDone = activeTasksForDay.length - done

                    if (activeTasksForDay.length === 0 || day.dayMidnight > todayMidnight) {
                      return (
                        <td
                          key={day.dateKey}
                          className="text-center py-1.5 px-0.5 border-r border-white/[0.03] text-[10px] font-mono text-muted/30"
                        >
                          —
                        </td>
                      )
                    }

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

      {/* ===== ADD / MANAGE REAL TASKS MODAL ===== */}
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
                      Create Real-Time Task
                    </h3>
                    <p className="text-xs text-muted">
                      Saved directly to your database and tracked in your real-time matrix.
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

              {/* Add New Task Form */}
              <form onSubmit={handleAddSubmit} className="py-4 border-b border-white/[0.06] space-y-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="What needs to get done?"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-silver focus:outline-none focus:border-cyan-400 placeholder:text-muted/60"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-muted block mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Add context, acceptance criteria, or links..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400 placeholder:text-muted/60 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as Priority)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block mb-1">Category</label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="e.g. Work, Dev, Health..."
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block mb-1">Deadline Date</label>
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs shadow-glow flex items-center gap-1.5 hover:opacity-90 transition-all"
                  >
                    <Plus size={14} />
                    <span>Save Task to Database</span>
                  </button>
                </div>
              </form>

              {/* Existing Tasks List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-2 pr-1">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-2">
                  Your Real Tasks ({tasks.length})
                </span>

                {tasks.length === 0 ? (
                  <p className="text-xs text-muted py-6 text-center">No tasks saved yet.</p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/30 transition-all flex items-center justify-between"
                    >
                      <div className="truncate pr-3">
                        <span
                          className={`text-xs font-semibold block truncate ${
                            task.completed ? 'text-muted line-through' : 'text-silver'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-[10px] text-muted">
                          {task.category || 'General'} • Priority: {task.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {task.id && (
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id!)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-rose-400 transition-colors"
                            title="Delete task from database"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
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
