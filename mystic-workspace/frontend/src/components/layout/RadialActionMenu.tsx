import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, ListTodo, CalendarPlus, MessageCirclePlus, VideoIcon, Upload, Palette, Sparkles, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

const ACTIONS = [
  { label: 'New Task', icon: ListTodo, to: '/tasks' },
  { label: 'New Event', icon: CalendarPlus, to: '/calendar' },
  { label: 'New Chat', icon: MessageCirclePlus, to: '/chat' },
  { label: 'New Meeting', icon: VideoIcon, to: '/meetings' },
  { label: 'New Whiteboard', icon: Palette, to: '/whiteboard' },
  { label: 'Upload File', icon: Upload, to: '/files' },
]

export default function RadialActionMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Hide the floating + button on Chat and Meetings pages to avoid covering send/call controls
  const isHidden =
    location.pathname.startsWith('/chat') ||
    location.pathname.startsWith('/meetings') ||
    location.pathname.startsWith('/meeting')

  if (isHidden) {
    return null
  }

  return (
    <div className="fixed bottom-24 md:bottom-8 right-6 md:right-8 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open &&
          ACTIONS.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 12, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.8 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 320, damping: 22 }}
              onClick={() => {
                setOpen(false)
                navigate(action.to)
              }}
              className="flex items-center gap-3 glass-panel px-4 py-2.5 hover:shadow-glow transition-shadow"
            >
              <span className="text-sm text-lavender whitespace-nowrap">{action.label}</span>
              <action.icon size={16} className="text-cyan-400" />
            </motion.button>
          ))}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.9 }}
        className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-glow flex items-center justify-center text-void-950"
      >
        <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <X size={24} /> : <Plus size={24} />}
        </motion.span>
      </motion.button>
    </div>
  )
}
