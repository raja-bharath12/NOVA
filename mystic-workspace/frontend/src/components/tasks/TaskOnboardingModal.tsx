import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Smartphone,
  PieChart,
  Tag,
  Clock,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Flame,
  FileText,
  ShieldCheck
} from 'lucide-react'

interface TaskOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateFirstTask: () => void
}

interface TutorialStep {
  title: string
  subtitle: string
  icon: any
  description: string
  details: string[]
  visualBadge: string
  visualType:
    | 'create'
    | 'title'
    | 'description'
    | 'priority'
    | 'category'
    | 'deadline'
    | 'completion'
    | 'history'
    | 'progress'
    | 'mobile'
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '1. Create Your First Task',
    subtitle: 'Start with a clean slate',
    icon: Plus,
    description: 'Every productive workflow begins with clear action items. Click "+ Create Task" to start.',
    details: [
      'No pre-filled fake tasks or mock habits.',
      'Your workspace starts 100% empty and clean.',
      'Directly linked to your authenticated user account.'
    ],
    visualBadge: 'Creation Flow',
    visualType: 'create'
  },
  {
    title: '2. Set Clear Task Titles',
    subtitle: 'Define actionable goals',
    icon: Sparkles,
    description: 'Enter concise, actionable task titles like "Finalize Q3 Performance Review" or "Deploy Auth Service".',
    details: [
      'Instant real-time search indexing.',
      'Auto-synced with global workspace search.',
      'Keyboard shortcut support for rapid entry.'
    ],
    visualBadge: 'Actionable Titles',
    visualType: 'title'
  },
  {
    title: '3. Add Detailed Descriptions',
    subtitle: 'Context & sub-notes',
    icon: FileText,
    description: 'Attach contextual notes, checklists, links, or acceptance criteria in the description field.',
    details: [
      'Supports up to 2000 characters of rich context.',
      'Accessible across all paired devices.',
      'Easily editable at any time without data loss.'
    ],
    visualBadge: 'Task Context',
    visualType: 'description'
  },
  {
    title: '4. Select Task Priority',
    subtitle: 'Organize by urgency',
    icon: Flame,
    description: 'Categorize your workload into High, Medium, or Low priority to optimize your daily focus.',
    details: [
      'High Priority: Urgent deadlines & critical deliverables.',
      'Medium Priority: Routine project tasks.',
      'Low Priority: Backlog and exploratory ideas.'
    ],
    visualBadge: 'Priority Levels',
    visualType: 'priority'
  },
  {
    title: '5. Organize by Category',
    subtitle: 'Work, Personal, Dev & Health',
    icon: Tag,
    description: 'Tag your tasks by domain (Work, Personal, Development, Health, Finance) for structured tracking.',
    details: [
      'Group routines by life & work areas.',
      'Visual color badges for instant scanning.',
      'Filterable in analytics summaries.'
    ],
    visualBadge: 'Categorization',
    visualType: 'category'
  },
  {
    title: '6. Set Realistic Deadlines',
    subtitle: 'Calendar scheduling',
    icon: Calendar,
    description: 'Attach target due dates to keep deliverables on track and highlight upcoming commitments.',
    details: [
      'Instant deadline countdown & badges.',
      'Auto-sorted into "Today" and "Upcoming" views.',
      'Integrates with your NOVA workspace calendar.'
    ],
    visualBadge: 'Due Dates',
    visualType: 'deadline'
  },
  {
    title: '7. Real-Time Task Completion',
    subtitle: '1-click toggle & sync',
    icon: CheckCircle2,
    description: 'Mark tasks complete with a single click. Changes immediately persist to the PostgreSQL database.',
    details: [
      'Immediate visual strike-through feedback.',
      'No localStorage discrepancies — DB is the source of truth.',
      'Instant progress recalculation.'
    ],
    visualBadge: 'Database Sync',
    visualType: 'completion'
  },
  {
    title: '8. Daily Matrix & History',
    subtitle: 'Strict real-world date tracking',
    icon: Layers,
    description: 'Track consistency across the month. Days before task creation show "—" (No Data).',
    details: [
      '— = Task did not exist yet on that date (No fake backfill).',
      '○ = Task existed on date and is active/pending.',
      '✓ = Task was actually completed.'
    ],
    visualBadge: 'Zero Fake History',
    visualType: 'history'
  },
  {
    title: '9. Dynamic Progress Calculation',
    subtitle: 'Calculated from real records only',
    icon: PieChart,
    description: 'Progress percentages represent real completion rates: (completed / total) × 100.',
    details: [
      'Brand new users start at 0% or "No activity yet".',
      'No fabricated 75% or 63% placeholder numbers.',
      'Daily, weekly, and monthly velocity metrics update live.'
    ],
    visualBadge: 'Live Analytics',
    visualType: 'progress'
  },
  {
    title: '10. Mobile Responsive View',
    subtitle: 'Productivity on any device',
    icon: Smartphone,
    description: 'Enjoy a customized mobile layout with date selector tabs, touch gestures, and quick completion.',
    details: [
      'Clean date switcher instead of squeezed desktop grids.',
      'Thumb-friendly 1-tap completion controls.',
      'Full offline-resilient sync when reconnected.'
    ],
    visualBadge: 'Responsive Design',
    visualType: 'mobile'
  }
]

export default function TaskOnboardingModal({ isOpen, onClose, onCreateFirstTask }: TaskOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Play subtle synth chime on step transition if unmuted
  const playStepChime = (stepIdx: number) => {
    if (isMuted) return
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const freq = 380 + stepIdx * 45
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.06, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    } catch {
      // Audio not supported or blocked by autoplay policy
    }
  }

  // Auto-play timer for tutorial walkthrough
  useEffect(() => {
    if (!isOpen || !isPlaying) return

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= TUTORIAL_STEPS.length - 1) {
          setIsPlaying(false)
          return prev
        }
        playStepChime(prev + 1)
        return prev + 1
      })
    }, 4500)

    return () => clearInterval(timer)
  }, [isOpen, isPlaying, isMuted])

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      playStepChime(currentStep + 1)
      setCurrentStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      playStepChime(currentStep - 1)
      setCurrentStep((s) => s - 1)
    }
  }

  const handleRestart = () => {
    setCurrentStep(0)
    setIsPlaying(true)
    playStepChime(0)
  }

  if (!isOpen) return null

  const step = TUTORIAL_STEPS[currentStep]
  const IconComponent = step.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-3 sm:p-6 overflow-y-auto">
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className={`glass-panel w-full max-w-4xl border border-cyan-500/30 shadow-2xl relative flex flex-col overflow-hidden bg-void-950/95 ${
          isFullscreen ? 'h-full max-w-none rounded-none' : 'rounded-3xl max-h-[92vh]'
        }`}
      >
        {/* Glow ambient spots */}
        <div className="absolute top-0 right-1/4 w-96 h-60 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Navigation Bar */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-500/40 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-glow">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-silver flex items-center gap-2">
                <span>Welcome to NOVA Tasks</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  Tutorial {currentStep + 1}/{TUTORIAL_STEPS.length}
                </span>
              </h2>
              <p className="text-xs text-muted hidden sm:block">
                Master real-time productivity, habit matrices, and strict database tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
              title={isMuted ? 'Unmute Audio Cue' : 'Mute Audio Cue'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-cyan-400" />}
            </button>
            <button
              onClick={handleToggleFullscreen}
              className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors hidden sm:block"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
              title="Close Tutorial"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Interactive Video Player Canvas Area */}
        <div className="flex-1 p-4 sm:p-7 overflow-y-auto custom-scrollbar relative z-10 flex flex-col justify-between gap-6">
          {/* Main Visual Stage (Mocked Live Video / Animation Frame) */}
          <div className="w-full rounded-2xl border border-white/[0.1] bg-black/40 p-4 sm:p-6 relative overflow-hidden shadow-inner flex flex-col md:flex-row gap-6 items-center">
            {/* Left: Animated Visual Simulator for Current Step */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center min-h-[220px] bg-void-900/80 rounded-2xl border border-white/[0.06] p-4 relative overflow-hidden">
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-[10px] text-muted font-mono ml-2">NOVA Stage Engine</span>
              </div>

              <div className="absolute top-3 right-3 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {step.visualBadge}
              </div>

              {/* Dynamic Interactive Visuals */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="w-full flex flex-col items-center justify-center text-center mt-6"
                >
                  {step.visualType === 'create' && (
                    <div className="space-y-3 w-full max-w-[260px]">
                      <div className="p-3 rounded-xl border border-dashed border-cyan-400/40 bg-cyan-500/10 flex items-center justify-center gap-2 text-cyan-300 text-xs font-semibold shadow-glow animate-pulse">
                        <Plus size={16} />
                        <span>[ + Create Task ]</span>
                      </div>
                      <p className="text-[11px] text-muted">Clean empty state — 0 demo clutter</p>
                    </div>
                  )}

                  {step.visualType === 'title' && (
                    <div className="space-y-2 w-full max-w-[280px]">
                      <div className="p-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] text-left">
                        <span className="text-[10px] text-muted block">Task Title</span>
                        <span className="text-xs text-silver font-medium">Complete Q3 System Retrospective</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">#work</span>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">High Priority</span>
                      </div>
                    </div>
                  )}

                  {step.visualType === 'description' && (
                    <div className="space-y-2 w-full max-w-[280px] text-left p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <span className="text-[10px] text-muted uppercase tracking-wider block font-semibold">Description & Acceptance Criteria</span>
                      <p className="text-[11px] text-silver/90 leading-snug">
                        1. Audit all DB indices<br/>
                        2. Validate WebRTC & STOMP latency<br/>
                        3. Test user data isolation
                      </p>
                    </div>
                  )}

                  {step.visualType === 'priority' && (
                    <div className="flex gap-2 justify-center">
                      <div className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold shadow-glow">
                        HIGH
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium">
                        MEDIUM
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-muted text-xs">
                        LOW
                      </div>
                    </div>
                  )}

                  {step.visualType === 'category' && (
                    <div className="grid grid-cols-2 gap-2 w-full max-w-[240px]">
                      <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold">💼 Work</span>
                      <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">🌱 Health</span>
                      <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-[11px] font-semibold">💻 Dev</span>
                      <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-semibold">✨ Personal</span>
                    </div>
                  )}

                  {step.visualType === 'deadline' && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-cyan-500/20 border border-cyan-400/30 text-center space-y-1 w-full max-w-[260px]">
                      <span className="text-[10px] text-muted uppercase tracking-wider block">Target Due Date</span>
                      <span className="text-sm font-bold font-mono text-cyan-300">Today, 11 Sep 2026</span>
                      <span className="text-[10px] text-emerald-400 block">● Scheduled for Today's Matrix</span>
                    </div>
                  )}

                  {step.visualType === 'completion' && (
                    <div className="w-full max-w-[280px] p-3 rounded-xl bg-white/[0.03] border border-cyan-500/40 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-left">
                        <div className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-silver line-through opacity-75 block">Deploy Core Pipeline</span>
                          <span className="text-[10px] text-emerald-400">Database Record Updated ✓</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {step.visualType === 'history' && (
                    <div className="w-full max-w-[300px] text-center space-y-2">
                      <div className="grid grid-cols-5 gap-1 text-[11px] font-mono">
                        <div className="p-1.5 rounded bg-black/40 text-muted">9 Sep<br/>—</div>
                        <div className="p-1.5 rounded bg-black/40 text-muted">10 Sep<br/>—</div>
                        <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">11 Sep<br/>✓</div>
                        <div className="p-1.5 rounded bg-black/40 text-muted">12 Sep<br/>—</div>
                        <div className="p-1.5 rounded bg-black/40 text-muted">13 Sep<br/>—</div>
                      </div>
                      <p className="text-[10px] text-cyan-300 font-mono">Strict: No fake past checkmarks</p>
                    </div>
                  )}

                  {step.visualType === 'progress' && (
                    <div className="w-full max-w-[260px] space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-muted">Real Rate:</span>
                        <span className="text-cyan-300 font-bold">1 / 1 (100%)</span>
                      </div>
                      <div className="w-full h-3 bg-white/[0.04] rounded-full border border-white/[0.1] overflow-hidden p-0.5">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 w-full" />
                      </div>
                      <span className="text-[10px] text-muted">Formula: (completed / total) × 100</span>
                    </div>
                  )}

                  {step.visualType === 'mobile' && (
                    <div className="w-full max-w-[220px] p-2.5 rounded-2xl bg-black/60 border border-cyan-500/30 text-left space-y-1.5 shadow-glow">
                      <div className="flex justify-between text-[10px] text-muted font-mono">
                        <span>📱 Mobile View</span>
                        <span className="text-cyan-300">11 Sep</span>
                      </div>
                      <div className="p-1.5 rounded bg-white/[0.04] text-[11px] text-silver flex justify-between items-center">
                        <span>Review PRs</span>
                        <span className="text-cyan-300 font-bold">Done</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right: Step Description & Feature Details */}
            <div className="w-full md:w-1/2 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-glow">
                  <IconComponent size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-silver">
                    {step.title}
                  </h3>
                  <span className="text-xs text-cyan-400 font-medium">{step.subtitle}</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-silver/80 leading-relaxed">
                {step.description}
              </p>

              <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                {step.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-muted">
                    <CheckCircle2 size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Player Controls & Timeline Scrubber */}
          <div className="space-y-3">
            {/* Step Chapter Indicator Dots / Bars */}
            <div className="grid grid-cols-10 gap-1.5">
              {TUTORIAL_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentStep(idx)
                    playStepChime(idx)
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStep
                      ? 'bg-gradient-to-r from-cyan-400 to-violet-500 shadow-glow'
                      : idx < currentStep
                      ? 'bg-cyan-500/40'
                      : 'bg-white/[0.08]'
                  }`}
                  title={`Jump to Step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Bottom Playback & Action Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              {/* Playback Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-glow"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={handleRestart}
                  className="p-1.5 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                  title="Restart Tutorial"
                >
                  <RotateCcw size={16} />
                </button>

                <div className="flex items-center gap-1 text-xs text-muted">
                  <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <span className="font-mono">{currentStep + 1} / {TUTORIAL_STEPS.length}</span>
                  <button
                    onClick={handleNext}
                    disabled={currentStep === TUTORIAL_STEPS.length - 1}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Primary Call to Action Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-silver font-medium text-xs transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => {
                    onClose()
                    onCreateFirstTask()
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 font-semibold text-xs shadow-glow flex items-center justify-center gap-1.5 hover:opacity-95 transition-all"
                >
                  <Plus size={14} />
                  <span>Create My First Task</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
