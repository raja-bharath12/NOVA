import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, MessageSquare, Sparkles, Command, Sun, Moon, Phone, CheckSquare, Trash2, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCall } from '../../context/CallContext'
import type { AppNotification } from '../../types'
import GlobalSearchModal from '../search/GlobalSearchModal'
import AiAssistantDrawer from '../ai/AiAssistantDrawer'

export default function TopBar() {
  const { user } = useAuth()
  const { notifications, unreadNotifsCount, clearNotifications, dismissNotification } = useCall()
  const navigate = useNavigate()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initials = user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') ?? '?'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearchModal((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleOpenNotification(notif: AppNotification) {
    setShowDropdown(false)
    if (notif.targetUrl) {
      navigate(notif.targetUrl)
    } else if (notif.type === 'MESSAGE') {
      navigate('/chat')
    } else if (notif.type === 'CALENDAR_EVENING' || notif.type === 'CALENDAR_MORNING') {
      navigate('/calendar')
    } else if (notif.type === 'TASK') {
      navigate('/tasks')
    }
  }

  function getNotificationIcon(type: AppNotification['type']) {
    switch (type) {
      case 'CALENDAR_EVENING':
        return (
          <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Moon size={14} />
          </div>
        )
      case 'CALENDAR_MORNING':
        return (
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sun size={14} />
          </div>
        )
      case 'CALL':
        return (
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Phone size={14} />
          </div>
        )
      case 'TASK':
        return (
          <div className="h-7 w-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckSquare size={14} />
          </div>
        )
      case 'MESSAGE':
      default:
        return (
          <div className="h-7 w-7 rounded-lg bg-violet-600/30 text-violet-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageSquare size={14} />
          </div>
        )
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 md:px-10 md:py-5 backdrop-blur-md bg-void-950/50 border-b border-white/[0.04]">
        {/* Mobile Brand Logo & Name */}
        <div className="flex md:hidden items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400 shadow-glow flex-shrink-0" />
          <span className="font-display font-bold text-xs tracking-[0.14em] text-gradient">
            MYSTIC
          </span>
        </div>

        {/* Desktop Search Trigger Bar */}
        <div
          onClick={() => setShowSearchModal(true)}
          className="relative hidden sm:flex items-center w-full max-w-xs cursor-pointer group"
        >
          <Search
            size={16}
            className="absolute left-3 text-muted group-hover:text-purple-400 transition-colors"
          />
          <input
            type="text"
            readOnly
            placeholder="Search workspace..."
            className="w-full bg-white/[0.03] group-hover:bg-white/[0.06] border border-white/[0.06] group-hover:border-purple-500/40 rounded-xl pl-9 pr-14 py-2 text-sm text-silver placeholder:text-muted cursor-pointer transition-all"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-white/10 text-white/50 px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-0.5">
            <Command size={10} />K
          </kbd>
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5 ml-auto relative" ref={dropdownRef}>
          {/* Mobile Search Trigger Icon */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSearchModal(true)}
            className="sm:hidden p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-muted hover:text-lavender border border-white/[0.06] transition-colors"
            title="Search Workspace"
          >
            <Search size={16} />
          </motion.button>

          {/* AI Co-Pilot Trigger Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setShowAiDrawer(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold shadow-glow transition-all"
            title="Open NOVA AI Assistant"
          >
            <Sparkles size={14} className="text-purple-400 animate-pulse" />
            <span className="hidden sm:inline">NOVA AI</span>
          </motion.button>

          {/* Notifications Bell - Desktop/Laptop only (hidden on mobile, as requested) */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setShowDropdown(!showDropdown)
              if (unreadNotifsCount > 0) {
                clearNotifications()
              }
            }}
            className="relative hidden md:flex p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-muted hover:text-lavender border border-white/[0.06] transition-colors"
            title="Notifications"
          >
            <Bell size={17} />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 min-w-[14px] px-1 rounded-full bg-cyan-400 text-void-950 text-[9px] font-bold flex items-center justify-center animate-pulseGlow">
                {unreadNotifsCount}
              </span>
            )}
          </motion.button>

          {/* Notifications Dropdown (Desktop / Laptop View) */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl glass-panel border border-violet-500/20 shadow-2xl p-4 z-50 bg-void-900/95 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-sm text-silver">
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {notifications.length}
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={12} />
                      Clear all
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted flex flex-col items-center justify-center gap-2">
                      <div className="h-10 w-10 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-muted">
                        <Bell size={18} />
                      </div>
                      <p>No new notifications</p>
                      <p className="text-[10px] text-muted/60">
                        You'll see messages and smart calendar reminders here
                      </p>
                    </div>
                  ) : (
                    notifications.slice(0, 15).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleOpenNotification(n)}
                        className="group flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-violet-500/10 cursor-pointer transition-all border border-transparent hover:border-violet-400/20 relative"
                      >
                        {getNotificationIcon(n.type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-silver truncate">
                            {n.title || n.senderName || 'Notification'}
                          </p>
                          <p className="text-[11px] text-muted/90 line-clamp-2 mt-0.5 leading-snug">
                            {n.body}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-mono text-muted/60">
                              {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) : 'Just now'}
                            </span>
                            {n.type === 'CALENDAR_EVENING' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 font-medium">
                                Evening Alert
                              </span>
                            )}
                            {n.type === 'CALENDAR_MORNING' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-medium">
                                Morning Plan
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>


          {/* User Avatar */}
          <div
            onClick={() => navigate('/settings')}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-medium text-void-950 font-display cursor-pointer hover:scale-105 transition-transform"
            title="Go to Settings"
          >
            {initials.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Global Command Palette Spotlight Search */}
      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      {/* NOVA AI Workspace Assistant Slide-over Drawer */}
      <AiAssistantDrawer
        isOpen={showAiDrawer}
        onClose={() => setShowAiDrawer(false)}
      />
    </>
  )
}
