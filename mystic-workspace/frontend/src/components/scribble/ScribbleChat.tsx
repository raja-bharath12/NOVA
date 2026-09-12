import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ScribbleChatMessage } from '../../types/scribble'

interface ScribbleChatProps {
  messages: ScribbleChatMessage[]
  onSendMessage: (text: string) => void
  hasGuessed: boolean
  isDrawer: boolean
  disabled?: boolean
}

export default function ScribbleChat({
  messages,
  onSendMessage,
  hasGuessed,
  isDrawer,
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
    if (!input.trim() || disabled) return
    onSendMessage(input.trim())
    setInput('')
  }

  return (
    <div className="w-full h-full bg-[#13141f]/80 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
          Live Chat & Guesses
        </h3>
        {hasGuessed && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 size={10} />
            <span>Guessed</span>
          </span>
        )}
      </div>

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
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
                  className="p-2 sm:p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-in fade-in slide-in-from-bottom-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🎉</span>
                    <span>{msg.content}</span>
                  </div>
                  {msg.pointsEarned ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-mono">
                      +{msg.pointsEarned} pts
                    </span>
                  ) : null}
                </div>
              )
            }

            if (msg.type === 'CLOSE_GUESS') {
              return (
                <div
                  key={msg.id}
                  className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-1.5 animate-pulse"
                >
                  <AlertCircle size={14} className="text-amber-400 shrink-0" />
                  <span>{msg.content}</span>
                </div>
              )
            }

            if (msg.type === 'SYSTEM' || msg.type === 'DRAWER_PICKED' || msg.type === 'PLAYER_JOIN' || msg.type === 'PLAYER_LEAVE') {
              return (
                <div
                  key={msg.id}
                  className="py-1 px-2.5 rounded-xl bg-white/[0.04] text-[11px] text-white/60 text-center font-medium border border-white/5"
                >
                  {msg.content}
                </div>
              )
            }

            // Normal Player Chat
            return (
              <div
                key={msg.id}
                className="text-xs p-1.5 rounded-xl hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-bold text-silver mr-1.5">{msg.senderName}:</span>
                <span className={msg.isPrivate ? 'text-emerald-300 italic' : 'text-white/80'}>
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
          disabled={disabled}
          placeholder={
            isDrawer
              ? 'You are drawing! Chat disabled during turn'
              : hasGuessed
              ? 'You solved it! Chat with other winners...'
              : 'Type your guess here...'
          }
          className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim() || isDrawer}
          className="p-2 sm:px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-glow"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
