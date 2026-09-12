import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ScribbleChatMessage } from '../../types/scribble'

interface ScribbleChatProps {
  messages: ScribbleChatMessage[]
  onSendMessage: (text: string) => void
  hasGuessed: boolean
  isDrawer: boolean
  currentUserId?: number
  currentUserName?: string
  disabled?: boolean
}

export default function ScribbleChat({
  messages,
  onSendMessage,
  hasGuessed,
  isDrawer,
  currentUserId,
  currentUserName,
  disabled,
}: ScribbleChatProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || disabled || hasGuessed || isDrawer) return
    onSendMessage(input.trim())
    setInput('')
  }

  const isSelf = (msg: ScribbleChatMessage) => {
    if (currentUserId && msg.senderId === currentUserId) return true
    if (currentUserName && msg.senderName && currentUserName.trim().toLowerCase() === msg.senderName.trim().toLowerCase()) return true
    return false
  }

  return (
    <div className="w-full h-full bg-[#13141f]/80 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
          <span>Chat & Guesses</span>
        </h3>
        {hasGuessed && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 size={10} />
            <span>✓ Solved</span>
          </span>
        )}
      </div>

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/40 text-xs">
            <Sparkles className="w-6 h-6 mb-2 text-purple-400 opacity-60" />
            <p>Guesses and chat messages will appear here.</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'CORRECT_GUESS') {
              return (
                <div
                  key={msg.id}
                  className="py-1.5 px-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm animate-in fade-in"
                >
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{msg.content}</span>
                </div>
              )
            }

            if (msg.type === 'DRAWER_PICKED') {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-2.5 rounded-xl bg-purple-500/15 text-[11px] text-purple-300 font-bold text-center border border-purple-500/25"
                >
                  🎨 {msg.content}
                </div>
              )
            }

            if (msg.type === 'SYSTEM' || msg.type === 'PLAYER_JOIN' || msg.type === 'PLAYER_LEAVE') {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-2.5 rounded-xl bg-white/[0.04] text-[11px] text-white/60 text-center font-medium border border-white/5"
                >
                  {msg.content}
                </div>
              )
            }

            // Normal Player Chat (You vs PlayerName)
            const self = isSelf(msg)
            return (
              <div
                key={msg.id}
                className="text-xs p-1 rounded-lg hover:bg-white/[0.02] transition-colors leading-relaxed"
              >
                <span className={`font-bold mr-1.5 ${self ? 'text-purple-400' : 'text-slate-300'}`}>
                  {self ? 'You' : msg.senderName}:
                </span>
                <span className="text-white/90">
                  {msg.content}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="pt-2 mt-2 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || hasGuessed || isDrawer}
          placeholder={
            isDrawer
              ? 'You are drawing! Chat disabled'
              : hasGuessed
              ? '✓ You guessed correctly!'
              : 'Type your guess here...'
          }
          className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim() || hasGuessed || isDrawer}
          className="p-2 sm:px-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-glow"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
