import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import RadialActionMenu from './RadialActionMenu'
import NotificationPermissionBanner from '../notifications/NotificationPermissionBanner'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-void-950 text-white relative">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 relative">
        <TopBar />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full px-3.5 sm:px-6 md:px-10 py-4 sm:py-6 md:py-8 max-w-full"
        >
          <NotificationPermissionBanner />
          {children}
        </motion.main>
      </div>
      <RadialActionMenu />
    </div>
  )
}

