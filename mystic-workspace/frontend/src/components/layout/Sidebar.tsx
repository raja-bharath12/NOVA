import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

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

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-[84px] hover:w-[220px] transition-[width] duration-300 ease-out flex-col justify-between z-30 group/sidebar overflow-hidden">
        <div className="glass-panel h-full flex flex-col rounded-none border-r border-white/[0.06] border-l-0 border-t-0 border-b-0">
          <div className="px-6 py-7 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400 shadow-glow flex-shrink-0" />
            <span className="font-display text-sm tracking-[0.12em] text-silver whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
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
                    <span className="text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 tracking-wide">
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
              <span className="text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                {user?.name?.split(' ')[0] ?? 'Sign out'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-panel rounded-none border-x-0 border-b-0">
        <div className="flex justify-around items-center px-2 py-2">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg ${
                    isActive ? 'text-violet-400' : 'text-muted'
                  }`}
                >
                  <item.icon size={20} strokeWidth={1.75} />
                  <span className="text-[10px] tracking-wide">{item.label}</span>
                </motion.div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
