import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Link as LinkIcon, User as UserIcon, Shield, Hash, Sparkles } from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { generateFallbackTag } from '../services/authService'

export default function Settings() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [copiedTag, setCopiedTag] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

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


  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gradient">Settings & Profile</h1>
        <p className="text-xs text-muted mt-1">Manage your identity, unique direct chat tag, and workspace link.</p>
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
    </div>
  )
}
