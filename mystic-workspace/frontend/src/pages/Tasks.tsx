import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import TaskItem from '../components/tasks/TaskItem'
import { taskService } from '../services/taskService'
import { useToast } from '../context/ToastContext'
import type { Task, Priority } from '../types'

type ViewFilter = 'today' | 'upcoming' | 'completed' | 'all'

export default function Tasks() {
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    taskService
      .list()
      .then(setTasks)
      .catch(() => showToast('Could not reach the server. Is the backend running?', 'warning'))
      .finally(() => setLoading(false))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const created = await taskService.create({ title, priority, deadline: deadline || undefined, completed: false })
      setTasks((t) => [created, ...t])
      setTitle('')
      setDeadline('')
      setPriority('MEDIUM')
      setShowForm(false)
      showToast('Task created')
    } catch {
      showToast('Could not create task', 'warning')
    }
  }

  async function handleToggle(id: number) {
    const previous = tasks
    setTasks((t) => t.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)))
    try {
      const updated = await taskService.toggle(id)
      if (updated.completed) showToast('Task completed')
      setTasks((t) => t.map((task) => (task.id === id ? updated : task)))
    } catch {
      setTasks(previous)
      showToast('Could not update task', 'warning')
    }
  }

  async function handleDelete(id: number) {
    const previous = tasks
    setTasks((t) => t.filter((task) => task.id !== id))
    try {
      await taskService.remove(id)
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

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gradient">Tasks</h1>
          <p className="label-tracked mt-1">
            <span className="luminous-number">{completedCount}</span> / {tasks.length} completed
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-void-950 shadow-glow"
        >
          <Plus size={16} /> New Task
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="glass-panel p-5 mb-6 flex flex-col gap-3 overflow-hidden"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
            />
            <div className="flex gap-3">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-silver focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-silver focus:outline-none"
              />
              <button
                type="submit"
                className="ml-auto rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-void-950"
              >
                Add
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mb-5">
        {(['all', 'today', 'upcoming', 'completed'] as ViewFilter[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`label-tracked rounded-full px-3 py-1.5 border transition-colors capitalize ${
              view === v ? 'border-violet-400/50 text-lavender bg-violet-500/10' : 'border-white/[0.06] text-muted hover:text-lavender'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <GlassPanel>
          <p className="text-muted text-sm">Loading tasks...</p>
        </GlassPanel>
      ) : filtered.length === 0 ? (
        <GlassPanel>
          <p className="text-muted text-sm">No tasks in this view yet.</p>
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
    </div>
  )
}
