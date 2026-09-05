import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import RadialActionMenu from './RadialActionMenu'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Sidebar />
      <div className="md:pl-[84px] pb-20 md:pb-0">
        <TopBar />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="px-6 md:px-10 py-8"
        >
          {children}
        </motion.main>
      </div>
      <RadialActionMenu />
    </div>
  )
}
