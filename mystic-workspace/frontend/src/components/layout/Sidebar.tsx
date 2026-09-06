import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  MessageSquare,
  Video,
  FolderOpen,
  PenTool,
  Settings as SettingsIcon,
  LogOut,
  Grid,
  X,
  Sparkles,
  Hash,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCall } from '../../context/CallContext'
import { generateFallbackTag } from '../../services/authService'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/meetings', label: 'Meetings', icon: Video },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/whiteboard', label: 'Whiteboard', icon: PenTool },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const MOBILE_PRIMARY_TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/meetings', label: 'Meet', icon: Video },
]

const MORE_SHEET_ITEMS = [
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, desc: 'Events & schedule' },
  { to: '/files', label: 'Files', icon: FolderOpen, desc: 'Cloud storage & media' },
  { to: '/whiteboard', label: 'Whiteboard', icon: PenTool, desc: 'Visual canvases' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, desc: 'Profile & chat tag' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { unreadNotifsCount } = useCall()
  const navigate = useNavigate()
  const location = useLocation()
  const [showMoreSheet, setShowMoreSheet] = useState(false)

  const effectiveTag = user?.userTag || (user ? generateFallbackTag(user.id, user.email) : '')

  const isMoreActive = MORE_SHEET_ITEMS.some((item) => location.pathname === item.to)

  const handleNavigateMore = (to: string) => {
    setShowMoreSheet(false)
    navigate(to)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-shrink-0 h-full w-[80px] hover:w-64 transition-all duration-300 ease-in-out flex-col justify-between z-30 group/sidebar overflow-hidden">
        <div className="glass-panel h-full flex flex-col rounded-none border-r border-white/[0.06] border-l-0 border-t-0 border-b-0">
          <div className="px-6 py-7 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400 shadow-glow flex-shrink-0" />
            <span className="font-display text-sm tracking-[0.12em] text-silver whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
              MYSTIC
            </span>
          </div>

          <nav className="flex-1 flex flex-col gap-1 px-4 mt-4">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 ${
                      isActive
                        ? 'bg-violet-500/[0.14] text-silver'
                        : 'text-muted hover:text-lavender hover:bg-white/[0.04]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="active-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-to-b from-violet-400 to-cyan-400 shadow-glow"
                      />
                    )}
                    <item.icon size={20} strokeWidth={1.75} className="flex-shrink-0 ml-1" />
                    <span className="text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 tracking-wide">
                      {item.label}
                    </span>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="px-4 pb-6">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-muted hover:text-lavender hover:bg-white/[0.04] transition-colors duration-200"
            >
              <LogOut size={20} strokeWidth={1.75} className="flex-shrink-0 ml-1" />
              <span className="text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
                {user?.name?.split(' ')[0] ?? 'Sign out'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-void-950/90 backdrop-blur-xl border-t border-white/[0.08] px-2 py-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {MOBILE_PRIMARY_TABS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'text-cyan-300 font-semibold'
                      : 'text-muted hover:text-silver'
                  }`}
                >
                  <div className="relative">
                    <item.icon size={19} strokeWidth={isActive ? 2.2 : 1.75} />
                    {item.to === '/chat' && unreadNotifsCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 h-3.5 min-w-[14px] px-1 rounded-full bg-cyan-400 text-void-950 text-[9px] font-bold flex items-center justify-center animate-pulseGlow">
                        {unreadNotifsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active-tab-glow"
                      className="absolute -bottom-1 h-1 w-6 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 shadow-glow"
                    />
                  )}
                </motion.div>
              )}
            </NavLink>
          ))}

          {/* More Sheet Trigger Button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowMoreSheet((prev) => !prev)}
            className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              isMoreActive || showMoreSheet
                ? 'text-purple-300 font-semibold'
                : 'text-muted hover:text-silver'
            }`}
          >
            <Grid size={19} strokeWidth={isMoreActive || showMoreSheet ? 2.2 : 1.75} />
            <span className="text-[10px] tracking-tight">More</span>
            {(isMoreActive || showMoreSheet) && (
              <motion.div
                layoutId="mobile-active-tab-glow"
                className="absolute -bottom-1 h-1 w-6 rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 shadow-glow"
              />
            )}
          </motion.button>
        </div>
      </nav>

      {/* Mobile "More" Slide-up Glass Sheet */}
      <AnimatePresence>
        {showMoreSheet && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreSheet(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-up Container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative z-10 w-full bg-void-900/95 border-t border-purple-500/25 rounded-t-3xl shadow-2xl p-5 pb-8 backdrop-blur-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            >
              {/* Drag Pill Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-1" />

              {/* Sheet Header with User Info */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center font-display font-bold text-sm text-void-950 shadow-glow">
                    {user?.name?.slice(0, 2).toUpperCase() || 'NO'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-silver">{user?.name}</h3>
                    <p className="text-xs text-muted truncate max-w-[180px]">{user?.email}</p>
                    {effectiveTag && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 mt-0.5">
                        <Hash size={10} /> {effectiveTag}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowMoreSheet(false)}
                  className="p-2 rounded-xl bg-white/[0.04] text-muted hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sheet Grid Items */}
              <div className="grid grid-cols-2 gap-3">
                {MORE_SHEET_ITEMS.map((item) => {
                  const Icon = item.icon
                  const active = location.pathname === item.to

                  return (
                    <button
                      key={item.to}
                      onClick={() => handleNavigateMore(item.to)}
                      className={`flex flex-col items-start p-3.5 rounded-2xl border transition-all text-left ${
                        active
                          ? 'bg-violet-600/20 border-violet-400/40 text-silver shadow-glow'
                          : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] text-silver'
                      }`}
                    >
                      <div className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-cyan-300 mb-2">
                        <Icon size={17} />
                      </div>
                      <span className="text-xs font-semibold text-silver">{item.label}</span>
                      <span className="text-[10px] text-muted mt-0.5">{item.desc}</span>
                    </button>
                  )
                })}
              </div>

              {/* Sign out button */}
              <button
                onClick={() => {
                  setShowMoreSheet(false)
                  logout()
                }}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <LogOut size={16} />
                <span>Sign Out of MYSTIC</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
