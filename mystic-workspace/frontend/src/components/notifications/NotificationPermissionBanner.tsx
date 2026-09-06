import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Sparkles, X, CheckCircle, ShieldAlert } from 'lucide-react'
import { useCall } from '../../context/CallContext'

export default function NotificationPermissionBanner() {
  const { permissionStatus, requestNotificationPermission } = useCall()
  const [dismissed, setDismissed] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('nova_notif_banner_dismissed')
    if (isDismissed) {
      setDismissed(true)
    }
  }, [])

  if (dismissed || permissionStatus === 'granted' || permissionStatus === 'denied') {
    return null
  }

  async function handleEnable() {
    setRequesting(true)
    try {
      await requestNotificationPermission()
    } finally {
      setRequesting(false)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem('nova_notif_banner_dismissed', 'true')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="w-full mb-4 overflow-hidden"
      >
        <div className="relative rounded-2xl bg-gradient-to-r from-violet-950/80 via-indigo-950/80 to-cyan-950/80 border border-violet-500/30 p-3.5 sm:p-4 shadow-glow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-void-950 flex items-center justify-center flex-shrink-0 shadow-glow mt-0.5 sm:mt-0">
              <Bell size={18} className="animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs sm:text-sm font-semibold text-silver font-display">
                  Enable Native Device Notifications
                </h4>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                  <Sparkles size={10} /> Smart Reminders
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted mt-0.5 leading-relaxed">
                Receive lock-screen alerts for new chat messages, incoming calls, and smart morning & evening calendar reminders directly on your phone or computer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleEnable}
              disabled={requesting}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-void-950 text-xs font-bold font-display shadow-glow hover:brightness-110 transition-all flex items-center gap-1.5"
            >
              {requesting ? (
                'Enabling...'
              ) : (
                <>
                  <CheckCircle size={14} />
                  <span>Allow Notifications</span>
                </>
              )}
            </motion.button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
