import { motion, AnimatePresence } from 'framer-motion'
import { Check, Trash2, Calendar } from 'lucide-react'
import type { Task } from '../../types'

interface Props {
  task: Task
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'text-cyan-400 border-cyan-400/30',
  MEDIUM: 'text-lavender border-lavender/30',
  LOW: 'text-muted border-muted/30',
}

export default function TaskItem({ task, onToggle, onDelete }: Props) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass-panel flex items-center gap-4 px-4 py-3.5"
    >
      <button
        onClick={() => task.id && onToggle(task.id)}
        className={`relative h-6 w-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.completed ? 'border-cyan-400 bg-cyan-400/20' : 'border-muted'
        }`}
      >
        <AnimatePresence>
          {task.completed && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Check size={14} className="text-cyan-400" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate transition-opacity font-medium ${task.completed ? 'text-muted line-through opacity-60' : 'text-silver'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted/80 truncate mt-0.5">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {task.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-muted font-mono">
              {task.category}
            </span>
          )}
          {task.deadline && (
            <p className="flex items-center gap-1 text-[11px] text-muted font-mono">
              <Calendar size={11} /> {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      <span className={`label-tracked border rounded-full px-2 py-0.5 flex-shrink-0 text-[10px] font-mono font-semibold ${PRIORITY_STYLES[task.priority]}`}>
        {task.priority}
      </span>


      <button
        onClick={() => task.id && onDelete(task.id)}
        className="text-muted hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </motion.li>
  )
}
