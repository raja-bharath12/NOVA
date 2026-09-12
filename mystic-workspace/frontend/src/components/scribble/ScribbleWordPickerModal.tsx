import { useEffect, useState } from 'react'
import { Palette, Sparkles, Clock } from 'lucide-react'
import type { WordOption } from '../../types/scribble'

interface ScribbleWordPickerModalProps {
  isOpen: boolean
  wordChoices: WordOption[]
  timeRemaining: number
  onSelectWord: (word: string) => void
}

export default function ScribbleWordPickerModal({
  isOpen,
  wordChoices,
  timeRemaining,
  onSelectWord,
}: ScribbleWordPickerModalProps) {
  if (!isOpen || !wordChoices || wordChoices.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141523] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/60 relative overflow-hidden">
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400" />

        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-3 animate-bounce">
            <Palette size={28} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Your Turn to Draw!</h2>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            Pick one of the words below before the timer runs out:
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs font-bold border border-purple-500/30">
            <Clock size={13} />
            <span>00:{timeRemaining.toString().padStart(2, '0')}</span>
          </div>
        </div>

        {/* 3 Word Choices Cards */}
        <div className="grid gap-3">
          {wordChoices.map((choice) => (
            <button
              key={choice.word}
              onClick={() => onSelectWord(choice.word)}
              className="p-4 rounded-2xl bg-white/[0.04] hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/50 flex items-center justify-between transition-all hover:scale-[1.02] text-left group"
            >
              <div>
                <span className="text-base sm:text-lg font-bold text-white group-hover:text-purple-300 tracking-wider block">
                  {choice.word}
                </span>
                <span className="text-xs text-white/50 block mt-0.5">{choice.hint}</span>
              </div>

              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  choice.difficulty === 'EASY'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : choice.difficulty === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {choice.difficulty}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
