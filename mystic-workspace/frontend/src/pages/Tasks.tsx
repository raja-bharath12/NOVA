import { useEffect, useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  CalendarCheck,
  CheckSquare,
  ListTodo,
  Play,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Calendar,
  Check,
  Tag,
  Flame,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import TaskItem from '../components/tasks/TaskItem'
import DailyHabitTracker from '../components/tasks/DailyHabitTracker'
import TaskOnboardingModal from '../components/tasks/TaskOnboardingModal'
import { taskService } from '../services/taskService'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import type { Task, Priority } from '../types'

type ViewFilter = 'today' | 'upcoming' | 'completed' | 'all'
type PageMode = 'list' | 'daily_matrix' | 'daily_task'

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function Tasks() {
  const { showToast } = useToast()
  const { user } = useAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pageMode, setPageMode] = useState<PageMode>('list')
  const [view, setView] = useState<ViewFilter>('all')

  // Task creation form state
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [category, setCategory] = useState('Work')
  const [deadline, setDeadline] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Manage modal state for daily habits
  const [isManageHabitsOpen, setIsManageHabitsOpen] = useState(false)

  // Onboarding Modal state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)

  // Mobile date picker state for daily view
  const [selectedMobileDate, setSelectedMobileDate] = useState<Date>(new Date())

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    setFetchError(null)
    taskService
      .list()
      .then((data) => {
        setTasks(data)
        // Check if user is brand new (0 tasks) and has not completed onboarding
        if (user) {
          const onboardingKey = `nova_tasks_onboarding_${user.id}`
          const hasSeenOnboarding = localStorage.getItem(onboardingKey)
          if (!hasSeenOnboarding && data.length === 0) {
            setIsOnboardingOpen(true)
          }
        }
      })
      .catch(() => {
        setFetchError('Unable to reach the server. Please check your connection or backend status.')
        showToast('Could not reach the server. Is the backend running?', 'warning')
      })
      .finally(() => setLoading(false))
  }

  const handleCloseOnboarding = () => {
    if (user) {
      localStorage.setItem(`nova_tasks_onboarding_${user.id}`, 'true')
    }
    setIsOnboardingOpen(false)
  }

  const handleOpenTutorial = () => {
    setIsOnboardingOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const created = await taskService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: category.trim() || 'Work',
        deadline: deadline || undefined,
        completed: false
      })
      setTasks((t) => [created, ...t])
      setTitle('')
      setDescription('')
      setDeadline('')
      setPriority('MEDIUM')
      setCategory('Work')
      setShowForm(false)
      showToast('Task created successfully')
      if (user) {
        localStorage.setItem(`nova_tasks_onboarding_${user.id}`, 'true')
      }
    } catch {
      showToast('Could not create task on server', 'warning')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDirectCreate(taskData: Partial<Task>) {
    try {
      const created = await taskService.create(taskData)
      setTasks((t) => [created, ...t])
      showToast('Task created successfully')
      if (user) {
        localStorage.setItem(`nova_tasks_onboarding_${user.id}`, 'true')
      }
    } catch {
      showToast('Could not create task', 'warning')
    }
  }

  async function handleToggle(id: number) {
    const previous = tasks
    setTasks((t) => t.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)))
    try {
      const updated = await taskService.toggle(id)
      if (updated.completed) showToast('Task marked as completed')
      setTasks((t) => t.map((task) => (task.id === id ? updated : task)))
    } catch {
      setTasks(previous)
      showToast('Could not update task on server', 'warning')
    }
  }

  async function handleDelete(id: number) {
    const previous = tasks
    setTasks((t) => t.filter((task) => task.id !== id))
    try {
      await taskService.remove(id)
      showToast('Task deleted')
    } catch {
      setTasks(previous)
      showToast('Could not delete task', 'warning')
    }
  }

  const filtered = tasks.filter((t) => {
    if (view === 'completed') return t.completed
    if (view === 'today') return t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString()
    if (view === 'upcoming') return !t.completed && t.deadline && new Date(t.deadline) >= new Date()
    return true
  })

  const completedCount = tasks.filter((t) => t.completed).length
  const completionPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  const handleOpenDailyTask = () => {
    setPageMode('daily_task')
    setIsManageHabitsOpen(true)
  }

  // Mobile Days Selector List (Current 7 Days window)
  const mobileDays = useMemo(() => {
    const result = []
    const today = new Date()
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      result.push(d)
    }
    return result
  }, [])

  return (
    <div className="w-full space-y-6">
      {/* Onboarding Interactive Tutorial Modal */}
      <TaskOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={handleCloseOnboarding}
        onCreateFirstTask={() => {
          setPageMode('list')
          setShowForm(true)
        }}
      />

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gradient">
            {pageMode === 'list'
              ? 'Tasks'
              : pageMode === 'daily_matrix'
              ? 'Daily Habit Matrix'
              : 'Daily Task & Habit Manager'}
          </h1>
          <p className="label-tracked mt-1 text-xs text-muted">
            {pageMode === 'list' ? (
              tasks.length === 0 ? (
                <span>No active tasks</span>
              ) : (
                <>
                  <span className="luminous-number text-cyan-300 font-mono font-bold">{completedCount}</span> /{' '}
                  <span className="font-mono">{tasks.length}</span> completed ({completionPercentage}%)
                </>
              )
            ) : pageMode === 'daily_matrix' ? (
              <span>Real-time accountability matrix. Database records only.</span>
            ) : (
              <span>Manage scheduled routines and configure task parameters.</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setPageMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pageMode === 'list'
                  ? 'bg-violet-600/30 text-silver border border-violet-500/30 shadow-glow'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <ListTodo size={14} />
              <span>Task List</span>
            </button>
            <button
              onClick={() => setPageMode('daily_matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pageMode === 'daily_matrix'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-glow'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <CheckSquare size={14} />
              <span>Daily Matrix</span>
            </button>
          </div>

          {/* Tutorial Button */}
          <button
            onClick={handleOpenTutorial}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-silver transition-all"
            title="Watch Page Tutorial"
          >
            <Play size={13} className="text-cyan-400 fill-current" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenDailyTask}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all shadow-glow ${
              pageMode === 'daily_task'
                ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 border border-cyan-400 text-cyan-200'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border border-cyan-500/30 hover:border-cyan-400 text-cyan-300'
            }`}
          >
            <CalendarCheck size={14} className="text-cyan-400" />
            <span>Daily Task</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setPageMode('list')
              setShowForm((v) => !v)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-void-950 shadow-glow transition-all"
          >
            <Plus size={15} />
            <span>New Task</span>
          </motion.button>
        </div>
      </div>

      {/* Error Banner (Never show demo data on error!) */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-rose-400" />
            <div>
              <p className="text-xs font-semibold">Unable to load your tasks</p>
              <p className="text-[11px] text-rose-300/80">{fetchError}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-rose-200 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={13} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Main Content Router */}
      {pageMode === 'daily_matrix' ? (
        <DailyHabitTracker
          tasks={tasks}
          onToggleTask={handleToggle}
          onCreateTask={handleDirectCreate}
          onDeleteTask={handleDelete}
          showEditHabitButton={false}
          isManageOpen={false}
          onOpenTutorial={handleOpenTutorial}
        />
      ) : pageMode === 'daily_task' ? (
        <DailyHabitTracker
          tasks={tasks}
          onToggleTask={handleToggle}
          onCreateTask={handleDirectCreate}
          onDeleteTask={handleDelete}
          showEditHabitButton={true}
          isManageOpen={isManageHabitsOpen}
          setIsManageOpen={setIsManageHabitsOpen}
          onOpenTutorial={handleOpenTutorial}
        />
      ) : (
        <>
          {/* Task Creation Form */}
          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreate}
                className="glass-panel p-5 mb-6 flex flex-col gap-3.5 overflow-hidden border border-cyan-500/30 shadow-glow"
              >
                <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} /> Create New Task
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-xs text-muted hover:text-silver"
                  >
                    Cancel
                  </button>
                </div>

                <input
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title (e.g. Complete project report)"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-cyan-400 transition-all placeholder:text-muted/60"
                />

                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description & acceptance notes (optional)"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400 transition-all placeholder:text-muted/60 resize-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1 font-semibold">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block mb-1 font-semibold">Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Work, Dev, Personal"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted block mb-1 font-semibold">Deadline</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-silver transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Plus size={14} />
                    <span>{isSubmitting ? 'Saving...' : 'Create Task'}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* View Filter Pills */}
          <div className="flex gap-1.5 sm:gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'today', 'upcoming', 'completed'] as ViewFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`label-tracked rounded-full px-3 py-1.5 border text-xs transition-colors capitalize whitespace-nowrap ${
                  view === v
                    ? 'border-cyan-400/50 text-cyan-300 bg-cyan-500/10 shadow-glow'
                    : 'border-white/[0.06] text-muted hover:text-lavender'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Loading Skeleton */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="glass-panel p-4 flex items-center gap-4 animate-pulse border border-white/[0.04]"
                >
                  <div className="h-6 w-6 rounded-full bg-white/10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-2/5" />
                    <div className="h-3 bg-white/5 rounded w-1/4" />
                  </div>
                  <div className="h-5 w-16 bg-white/10 rounded-full" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            /* Premium Empty State */
            <GlassPanel className="p-8 sm:p-12 text-center border border-white/[0.08] shadow-glass relative overflow-hidden">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-cyan-400/30 mx-auto flex items-center justify-center text-cyan-300 shadow-glow">
                  <Sparkles size={26} />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-display font-bold text-silver">
                    Welcome to your NOVA workspace
                  </h2>
                  <p className="text-xs text-muted leading-relaxed">
                    You don't have any tasks yet. Create your first task to start tracking your productivity.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleOpenTutorial}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-silver border border-white/[0.1] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Play size={14} className="text-cyan-400 fill-current" />
                    <span>Watch Tutorial</span>
                  </button>

                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow flex items-center justify-center gap-2 hover:opacity-95 transition-all"
                  >
                    <Plus size={15} />
                    <span>+ Create Task</span>
                  </button>
                </div>
              </div>
            </GlassPanel>
          ) : filtered.length === 0 ? (
            <GlassPanel className="p-6 text-center">
              <p className="text-muted text-xs">No tasks found matching this view filter.</p>
            </GlassPanel>
          ) : (
            <ul className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((task) => (
                  <TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}
    </div>
  )
}
