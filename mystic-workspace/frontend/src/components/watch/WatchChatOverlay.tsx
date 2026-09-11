import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Smile,
  ChevronDown,
  Hash,
  Users
} from 'lucide-react'
import type { WatchChatMessage, User } from '../../types'

interface WatchChatOverlayProps {
  roomCode: string
  currentUser: User | null
  messages: WatchChatMessage[]
  onSendMessage: (content: string) => void
  isChatOpen: boolean
  onToggleChat: (open: boolean) => void
  unreadCount: number
  onClearUnread: () => void
}

interface FloatingToast {
  id: string
  senderName: string
  content: string
  createdAt: number
}

export default function WatchChatOverlay({
  roomCode,
  currentUser,
  messages,
  onSendMessage,
  isChatOpen,
  onToggleChat,
  unreadCount,
  onClearUnread
}: WatchChatOverlayProps) {
  const [inputText, setInputText] = useState('')
  const [floatingToasts, setFloatingToasts] = useState<FloatingToast[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSeenMsgCountRef = useRef(messages.length)

  // Auto-scroll chat to bottom when new messages arrive and chat is open
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      onClearUnread()
    }
  }, [messages, isChatOpen])

  // Detect new incoming messages when chat is closed to trigger floating toasts
  useEffect(() => {
    if (messages.length > lastSeenMsgCountRef.current) {
      const newMessages = messages.slice(lastSeenMsgCountRef.current)
      lastSeenMsgCountRef.current = messages.length

      if (!isChatOpen) {
        newMessages.forEach((msg) => {
          // Do not show floating toast for sender's own messages
          if (currentUser && msg.senderId === currentUser.id) return

          const toast: FloatingToast = {
            id: 'toast_' + Date.now() + '_' + Math.random(),
            senderName: msg.senderName || 'Participant',
            content: msg.content,
            createdAt: Date.now()
          }

          setFloatingToasts((prev) => {
            const next = [...prev.slice(-2), toast] // Limit to max 3 stacked toasts
            return next
          })

          // Auto-fade after 4.5 seconds
          setTimeout(() => {
            setFloatingToasts((current) => current.filter((t) => t.id !== toast.id))
          }, 4500)
        })
      }
    } else {
      lastSeenMsgCountRef.current = messages.length
    }
  }, [messages, isChatOpen, currentUser])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  const handleToastClick = () => {
    onToggleChat(true)
    setFloatingToasts([])
  }

  return (
    <>
      {/* ===== 1. YOUTUBE-LIVE FLOATING NOTIFICATIONS (WHEN CHAT IS CLOSED) ===== */}
      <div className="absolute bottom-20 left-4 z-40 flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-none">
        <AnimatePresence>
          {!isChatOpen &&
            floatingToasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                onClick={handleToastClick}
                className="pointer-events-auto cursor-pointer p-3 rounded-2xl bg-void-950/90 border border-cyan-500/40 shadow-2xl backdrop-blur-xl flex items-start gap-3 hover:border-cyan-400 hover:scale-[1.02] transition-all group"
              >
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center font-bold text-xs text-void-950 shadow-glow shrink-0">
                  {toast.senderName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-cyan-300 truncate">
                      {toast.senderName}
                    </span>
                    <span className="text-[9px] text-muted font-mono">click to open</span>
                  </div>
                  <p className="text-xs text-silver truncate mt-0.5 group-hover:text-white">
                    {toast.content}
                  </p>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {/* ===== 2. TOGGLE CHAT BUTTON (WITH UNREAD BADGE) ===== */}
      <button
        onClick={() => {
          if (!isChatOpen) {
            onToggleChat(true)
            onClearUnread()
          } else {
            onToggleChat(false)
          }
        }}
        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-glow ${
          isChatOpen
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            : 'bg-white/[0.05] hover:bg-white/[0.1] text-silver border border-white/[0.1]'
        }`}
        title="Toggle Watch Room Chat"
      >
        <MessageSquare size={15} className={isChatOpen ? 'text-cyan-400' : 'text-muted'} />
        <span>Chat</span>
        {!isChatOpen && unreadCount > 0 && (
          <span className="h-4 min-w-[16px] px-1 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-void-950 text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ===== 3. DESKTOP SIDEBAR / MOBILE DRAWER CHAT PANEL ===== */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="w-full lg:w-80 xl:w-96 h-full flex flex-col bg-void-950/95 border-l border-white/[0.08] backdrop-blur-2xl shadow-2xl rounded-2xl lg:rounded-none overflow-hidden"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-silver flex items-center gap-1.5">
                    <span>Live Room Chat</span>
                  </h3>
                  <span className="text-[10px] text-muted font-mono">
                    Room: {roomCode}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onToggleChat(false)}
                className="p-1.5 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                title="Close Chat Panel"
              >
                <X size={17} />
              </button>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted space-y-2">
                  <Sparkles size={24} className="text-cyan-400/60" />
                  <p className="text-xs">No messages yet.</p>
                  <p className="text-[11px] text-muted/70">Be the first to say something in the room!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = currentUser && msg.senderId === currentUser.id

                  return (
                    <motion.div
                      key={msg.id || idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2.5"
                    >
                      <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-500/40 border border-cyan-400/30 flex items-center justify-center font-bold text-[10px] text-cyan-200 shrink-0 mt-0.5">
                        {msg.senderName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[11px] font-semibold truncate ${isMine ? 'text-cyan-300' : 'text-purple-300'}`}>
                            {msg.senderName}
                          </span>
                          <span className="text-[9px] text-muted font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-silver/90 break-words leading-relaxed mt-0.5">
                          {msg.content}
                        </p>
                      </div>
                    </motion.div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-1.5 focus-within:border-cyan-400/50 transition-all">
                <input
                  type="text"
                  placeholder="Chat with participants..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-silver placeholder:text-muted/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="h-8 w-8 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-void-950 flex items-center justify-center shadow-glow disabled:opacity-30 disabled:pointer-events-none transition-all"
                >
                  <Send size={13} className="ml-0.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
