import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Link as LinkIcon, User as UserIcon, Shield, Hash, Sparkles, Bell, Moon, Sun, Phone, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'
import { useCall } from '../context/CallContext'
import { useToast } from '../context/ToastContext'
import { generateFallbackTag } from '../services/authService'
import { notificationService } from '../services/notificationService'

export default function Settings() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { permissionStatus, requestNotificationPermission } = useCall()
  const [copiedTag, setCopiedTag] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [testingNotif, setTestingNotif] = useState(false)

  const effectiveTag = user?.userTag || (user ? generateFallbackTag(user.id, user.email) : '')
  const directChatLink = effectiveTag ? `${window.location.origin}/chat/u/${effectiveTag}` : ''

  function copyTag() {
    if (!effectiveTag) return
    navigator.clipboard.writeText(effectiveTag)
    setCopiedTag(true)
    showToast('Your Chat ID copied to clipboard!', 'success')
    setTimeout(() => setCopiedTag(false), 2000)
  }

  function copyLink() {
    if (!directChatLink) return
    navigator.clipboard.writeText(directChatLink)
    setCopiedLink(true)
    showToast('Direct Chat Link copied to clipboard!', 'success')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleTestNotification() {
    setTestingNotif(true)
    try {
      if (permissionStatus !== 'granted') {
        const granted = await requestNotificationPermission()
        if (!granted) {
          showToast('Please allow notification permission in your browser.', 'info')
          return
        }
      }
      await notificationService.showNativeNotification('🌟 NOVA Workspace Alert', {
        body: 'Native push notifications are active! You will receive lock screen alerts for messages, calls & calendar reminders.',
        url: '/calendar',
      })
      showToast('Test notification sent to your device!', 'success')
    } finally {
      setTestingNotif(false)
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gradient">Settings & Profile</h1>
        <p className="text-xs text-muted mt-1">Manage your identity, unique direct chat tag, and workspace notification preferences.</p>
      </div>

      {/* Profile Overview Card */}
      <GlassPanel className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-lg sm:text-xl font-bold text-void-950 font-display shadow-glow flex-shrink-0">
              {user?.name?.slice(0, 2).toUpperCase() || 'NO'}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-semibold text-silver">{user?.name}</h2>
              <p className="text-xs text-muted truncate max-w-[200px] sm:max-w-none">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">
                  <Hash size={11} />
                  {effectiveTag || 'Generating...'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">
                  <Shield size={10} /> Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Direct Chat ID & Link Card */}
        <div className="mt-6 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono tracking-wider font-semibold text-muted uppercase block mb-1">
                Your Unique 10-Char Chat ID
              </span>
              <p className="font-mono text-base font-bold text-silver tracking-wider">
                {effectiveTag || 'Generating...'}
              </p>
              <p className="text-[11px] text-muted mt-1">
                Share this unique ID with teammates so they can connect with you directly.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={copyTag}
              disabled={!effectiveTag}
              className="w-full py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-violet-600/30 text-silver hover:text-cyan-300 border border-white/[0.08] hover:border-violet-400/40 text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-glow disabled:opacity-40"
            >
              {copiedTag ? <Check size={14} className="text-cyan-400" /> : <Copy size={14} />}
              <span>{copiedTag ? 'Copied ID!' : 'Copy Chat ID'}</span>
            </motion.button>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-600/10 to-cyan-500/10 border border-violet-500/20 flex flex-col justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono tracking-wider font-semibold text-cyan-400 uppercase block mb-1">
                1-Click Direct Chat Invite Link
              </span>
              <p className="font-mono text-xs text-silver truncate bg-void-950/60 p-2 rounded-lg border border-white/[0.06]">
                {directChatLink || 'Generating Link...'}
              </p>
              <p className="text-[11px] text-muted mt-1">
                Anyone clicking this URL will automatically open a private direct chat with you.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={copyLink}
              disabled={!directChatLink}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-glow disabled:opacity-40"
            >
              {copiedLink ? <Check size={14} /> : <LinkIcon size={14} />}
              <span>{copiedLink ? 'Copied Invite Link!' : 'Copy Direct Chat Link'}</span>
            </motion.button>
          </div>
        </div>
      </GlassPanel>

      {/* Notifications & Smart Calendar Alerts Settings Card */}
      <GlassPanel className="p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center text-cyan-300 flex-shrink-0">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-display font-semibold text-silver">
                Notifications & Device Alerts
              </h3>
              <p className="text-xs text-muted">
                Dual-mode alert system configured for seamless mobile & desktop experience.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {permissionStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 size={13} />
                Native Push Active
              </span>
            ) : permissionStatus === 'denied' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                <AlertCircle size={13} />
                Permission Blocked
              </span>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={requestNotificationPermission}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-void-950 text-xs font-bold font-display shadow-glow"
              >
                Allow Notifications
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleTestNotification}
              disabled={testingNotif}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-silver border border-white/[0.08] text-xs font-medium transition-colors"
            >
              Test Notification
            </motion.button>
          </div>
        </div>

        {/* Feature Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Item 1: Evening Before */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Moon size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-silver font-display">
                🌙 Evening-Before Calendar Reminder
              </h4>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Triggers automatically at 6:00 PM for events scheduled on the next day so you can prepare your evening ahead.
              </p>
            </div>
          </div>

          {/* Item 2: Morning Of */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sun size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-silver font-display">
                ☀️ Morning-Of Daily Agenda
              </h4>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Sends a morning briefing at 6:00 AM for today's scheduled meetings, dead-lines, and calendar items.
              </p>
            </div>
          </div>

          {/* Item 3: Direct Messages & Group Chat */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-silver font-display">
                💬 Instant Chat Push
              </h4>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Delivers real-time native device push notifications whenever teammates send direct messages or team chat mentions.
              </p>
            </div>
          </div>

          {/* Item 4: Real-time Audio/Video Calls */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Phone size={16} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-silver font-display">
                📞 Audio & Video Call Rings
              </h4>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Provides instant vibrating lock-screen alerts when a teammate starts a call with you.
              </p>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}

