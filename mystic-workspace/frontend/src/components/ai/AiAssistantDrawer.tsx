import React, { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  X,
  Send,
  Calendar,
  CheckSquare,
  BarChart3,
  Bot,
  User as UserIcon,
  Plus,
  Check,
  Zap,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import aiService, { type AiChatResponsePayload } from '../../services/aiService'
import type { AiChatMessage, AiProductivityAnalytics, AiTaskSuggestion } from '../../types'
import { useAuth } from '../../context/AuthContext'

interface AiAssistantDrawerProps {
  isOpen: boolean
  onClose: () => void
}

interface MessageItem {
  role: 'USER' | 'ASSISTANT'
  text: string
  payload?: AiChatResponsePayload
  timestamp: string
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      role: 'ASSISTANT',
      text: `Greetings, ${user?.name || 'Explorer'}. I am NOVA AI, your intelligent productivity co-pilot. I analyze your tasks, meetings, deadlines, and files to keep you focused and organized. What shall we optimize today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [addedTaskIndices, setAddedTaskIndices] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'CHAT' | 'ANALYTICS'>('CHAT')
  const [analytics, setAnalytics] = useState<AiProductivityAnalytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      if (activeTab === 'ANALYTICS' && !analytics) {
        loadAnalytics()
      }
    }
  }, [isOpen, messages, activeTab])

  const loadAnalytics = async () => {
    try {
      setLoadingAnalytics(true)
      const data = await aiService.getAnalytics()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load AI analytics', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const handleSend = async (promptToSend?: string) => {
    const text = (promptToSend || inputPrompt).trim()
    if (!text || loading) return

    const userMsg: MessageItem = {
      role: 'USER',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputPrompt('')
    setLoading(true)

    try {
      const history: AiChatMessage[] = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text,
      }))

      const response = await aiService.chat(text, history)

      const assistantMsg: MessageItem = {
        role: 'ASSISTANT',
        text: response.reply,
        payload: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error('AI assistant error', err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'ASSISTANT',
          text: 'I encountered an issue processing your request. Please check your connection and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Add suggested tasks to database
  const handleAddTasks = async (msgIndex: number, tasks: AiTaskSuggestion[]) => {
    try {
      await aiService.createSuggestedTasks(tasks)
      setAddedTaskIndices((prev) => {
        const next = new Set(prev)
        next.add(`msg-${msgIndex}`)
        return next
      })
    } catch (err) {
      console.error('Failed to create suggested tasks', err)
      alert('Failed to add tasks to your board.')
    }
  }

  const QUICK_PROMPTS = [
    { label: "Plan Today's Schedule", prompt: 'Organize my schedule and agenda for today with focus blocks' },
    { label: 'Generate Subtasks', prompt: 'Create tasks to implement the new microservice architecture' },
    { label: 'Productivity Review', prompt: 'Analyze my task completion rate and give me recommendations' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto md:hidden"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[#0e0c1f]/95 border-l border-purple-500/20 shadow-2xl backdrop-blur-2xl flex flex-col pointer-events-auto z-10"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 p-0.5 shadow-lg shadow-purple-600/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>NOVA AI Assistant</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  </h2>
                  <p className="text-xs text-white/40">Workspace Intelligence</p>
                </div>
              </div>

              {/* Tabs & Close Button */}
              <div className="flex items-center gap-2">
                <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10">
                  <button
                    onClick={() => setActiveTab('CHAT')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'CHAT'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('ANALYTICS')
                      if (!analytics) loadAnalytics()
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'ANALYTICS'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Analytics
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tab: Chat & Recommendations */}
            {activeTab === 'CHAT' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        m.role === 'USER' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {m.role === 'ASSISTANT' && (
                        <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-purple-300" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${
                          m.role === 'USER'
                            ? 'bg-purple-600 text-white rounded-br-none'
                            : 'bg-white/[0.04] border border-white/10 text-white/90 rounded-bl-none'
                        }`}
                      >
                        {/* Text Content */}
                        <div className="whitespace-pre-line">{m.text}</div>

                        {/* Interactive Task Suggestions Card */}
                        {m.payload?.suggestedTasks && m.payload.suggestedTasks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                              <span className="flex items-center gap-1.5">
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Suggested Tasks ({m.payload.suggestedTasks.length})</span>
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {m.payload.suggestedTasks.map((st, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-start justify-between gap-2"
                                >
                                  <div>
                                    <div className="font-semibold text-xs text-white">
                                      {st.title}
                                    </div>
                                    {st.description && (
                                      <div className="text-[11px] text-white/50 mt-0.5">
                                        {st.description}
                                      </div>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                      st.priority === 'HIGH'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    }`}
                                  >
                                    {st.priority}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <button
                              disabled={addedTaskIndices.has(`msg-${idx}`)}
                              onClick={() => handleAddTasks(idx, m.payload!.suggestedTasks!)}
                              className={`w-full mt-2 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                addedTaskIndices.has(`msg-${idx}`)
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md'
                              }`}
                            >
                              {addedTaskIndices.has(`msg-${idx}`) ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Added to Tasks</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Add Tasks to My Board</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        <div className="text-[10px] text-white/30 text-right mt-1">
                          {m.timestamp}
                        </div>
                      </div>

                      {m.role === 'USER' && (
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/40 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-1">
                          <UserIcon className="w-4 h-4 text-indigo-300" />
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-center gap-2 text-xs text-purple-400 font-mono py-2">
                      <Sparkles className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Synthesizing workspace context...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                <div className="p-3 border-t border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(qp.prompt)}
                      className="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>{qp.label}</span>
                    </button>
                  ))}
                </div>

                {/* Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                  }}
                  className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    placeholder="Ask NOVA AI (e.g., plan my day, create tasks)..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputPrompt.trim()}
                    className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white shadow-md transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              /* Tab: Analytics View */
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {loadingAnalytics ? (
                  <div className="flex items-center justify-center p-12 text-sm text-white/50">
                    <Sparkles className="w-5 h-5 animate-spin text-purple-400 mr-2" />
                    <span>Analyzing performance telemetry...</span>
                  </div>
                ) : analytics ? (
                  <>
                    {/* Focus & Completion Overview */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                        <span className="text-xs text-white/40 block mb-1">Completion Rate</span>
                        <div className="text-2xl font-black text-purple-300">
                          {Math.round(analytics.completionRate)}%
                        </div>
                        <span className="text-[11px] text-emerald-400 font-medium">
                          {analytics.completedTasks} / {analytics.totalTasks} tasks done
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                        <span className="text-xs text-white/40 block mb-1">Pending Actions</span>
                        <div className="text-2xl font-black text-indigo-300">
                          {analytics.pendingTasks}
                        </div>
                        <span className="text-[11px] text-indigo-400 font-medium">
                          {analytics.upcomingDeadlines} deadlines today
                        </span>
                      </div>
                    </div>

                    {/* AI Insight Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-300 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>AI Executive Summary</span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">
                        {analytics.productivityInsight}
                      </p>
                    </div>

                    {/* Quick Action to Trigger Daily Schedule */}
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">Generate Daily Schedule</h4>
                        <p className="text-[11px] text-white/50">
                          Auto-schedule tasks around your upcoming meetings.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('CHAT')
                          handleSend('Organize my schedule and agenda for today with focus blocks')
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md"
                      >
                        Plan Day
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8 text-white/40 text-xs">
                    No analytics available.
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default AiAssistantDrawer
