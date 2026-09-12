import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Smartphone, Apple, Monitor, Download, Share, PlusSquare, CheckCircle, Sparkles } from 'lucide-react'

interface InstallAppModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [activeTab, setActiveTab] = useState<'AUTO' | 'ANDROID' | 'IOS' | 'DESKTOP'>('AUTO')
  const [detectedOs, setDetectedOs] = useState<'ANDROID' | 'IOS' | 'WINDOWS' | 'MAC' | 'OTHER'>('OTHER')

  useEffect(() => {
    // Detect OS
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera
    if (/android/i.test(ua)) {
      setDetectedOs('ANDROID')
      setActiveTab('ANDROID')
    } else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setDetectedOs('IOS')
      setActiveTab('IOS')
    } else if (/Mac/i.test(ua)) {
      setDetectedOs('MAC')
      setActiveTab('DESKTOP')
    } else if (/Win/i.test(ua)) {
      setDetectedOs('WINDOWS')
      setActiveTab('DESKTOP')
    } else {
      setActiveTab('AUTO')
    }

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true)
    }

    // Listen for PWA beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  async function handleNativeInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-void-950/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg glass-panel border border-violet-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl bg-void-900/95 overflow-hidden text-silver"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-void-950 shadow-glow">
                <Download size={18} />
              </div>
              <div>
                <h3 className="font-display font-bold text-base sm:text-lg text-silver flex items-center gap-2">
                  Install NOVA App
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">
                    Universal PWA
                  </span>
                </h3>
                <p className="text-xs text-muted">Use NOVA full-screen on mobile and desktop without browser bars</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Platform Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl my-4">
            <button
              type="button"
              onClick={() => setActiveTab('ANDROID')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'ANDROID'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <Smartphone size={13} />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('IOS')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'IOS'
                  ? 'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-lavender border border-violet-400/30 shadow-sm'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <Apple size={13} />
              <span>iPhone (iOS)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DESKTOP')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'DESKTOP'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/30 shadow-sm'
                  : 'text-muted hover:text-silver'
              }`}
            >
              <Monitor size={13} />
              <span>Windows & Mac</span>
            </button>
          </div>

          {/* Tab 1: Android Instructions */}
          {activeTab === 'ANDROID' && (
            <div className="space-y-4">
              {deferredPrompt && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-violet-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">1-Click Instant Install</h4>
                    <p className="text-[11px] text-muted">Add NOVA to your home screen right now</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNativeInstall}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-void-950 font-bold text-xs shadow-glow transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Install Now</span>
                  </motion.button>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold">Open in Google Chrome</p>
                    <p className="text-[11px] text-muted mt-0.5">Tap the <strong>three dots (⋮)</strong> at the top-right of your screen.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold">Select "Install App" or "Add to Home Screen"</p>
                    <p className="text-[11px] text-muted mt-0.5">Chrome will download the standalone package onto your Android device.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold">Launch NOVA from Home Screen</p>
                    <p className="text-[11px] text-muted mt-0.5">Enjoy full-screen calling, notifications, and background music sync!</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: iPhone (iOS) Instructions */}
          {activeTab === 'IOS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-violet-600/15 to-cyan-500/15 border border-violet-500/30 text-xs">
                <span className="font-semibold text-lavender flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} className="text-cyan-400" />
                  Install on iPhone via Safari
                </span>
                <p className="text-[11px] text-muted leading-relaxed">
                  Apple iPhones allow 1-click standalone installation directly through Safari with full support for video calls and lock-screen push alerts.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-violet-500/20 text-lavender font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold flex items-center gap-1.5">
                      Tap the <Share size={13} className="text-cyan-400 inline" /> Share Button in Safari
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">Located at the bottom center of your iPhone Safari screen.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-violet-500/20 text-lavender font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold flex items-center gap-1.5">
                      Scroll down & tap <PlusSquare size={13} className="text-cyan-400 inline" /> "Add to Home Screen"
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">This packages NOVA with an app icon on your iOS home screen.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-violet-500/20 text-lavender font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold">Tap "Add" in top-right</p>
                    <p className="text-[11px] text-muted mt-0.5">NOVA will launch in full screen with zero Safari browser bars.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Desktop (Windows / Mac) Instructions */}
          {activeTab === 'DESKTOP' && (
            <div className="space-y-3">
              {deferredPrompt && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/15 to-violet-500/15 border border-cyan-500/30 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-cyan-300">Install Desktop Application</h4>
                    <p className="text-[11px] text-muted">Pins to your Windows Taskbar or Mac Dock</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNativeInstall}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow transition-all flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Install App</span>
                  </motion.button>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold">In Chrome / Edge address bar:</p>
                    <p className="text-[11px] text-muted mt-0.5">Click the <strong>Install icon (monitor with down-arrow)</strong> on the right side of the URL bar.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-silver">
                    <p className="font-semibold">In Mac Safari (macOS Sonoma / later):</p>
                    <p className="text-[11px] text-muted mt-0.5">Click <strong>File</strong> in the top menu bar → click <strong>"Add to Dock"</strong>.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Footer Status */}
          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle size={13} />
              {isInstalled ? 'App is installed & running in standalone mode' : 'Supports offline caching & lock-screen calls'}
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-silver transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
