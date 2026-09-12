import { Trophy, Crown, ArrowRight, RotateCcw, Award } from 'lucide-react'
import type { PlayerState, GamePhase } from '../../types/scribble'

interface ScribbleEndRoundModalProps {
  phase: GamePhase
  revealedWord: string
  players: PlayerState[]
  onPlayAgain?: () => void
}

export default function ScribbleEndRoundModal({
  phase,
  revealedWord,
  players,
  onPlayAgain,
}: ScribbleEndRoundModalProps) {
  if (phase !== 'ROUND_END' && phase !== 'GAME_OVER') return null

  const isGameOver = phase === 'GAME_OVER'
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const winner = sorted[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#141523] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
        {/* Glow Top Strip */}
        <div
          className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${
            isGameOver
              ? 'from-amber-400 via-purple-500 to-cyan-400'
              : 'from-purple-500 to-indigo-500'
          }`}
        />

        {isGameOver ? (
          <>
            <div className="inline-flex p-4 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-4 animate-bounce">
              <Trophy size={36} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Match Finished!</h2>
            <p className="text-xs sm:text-sm text-white/60 mt-1">
              Here are the final standings of the game arena:
            </p>

            {/* Podium Display (Top 3) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 my-6 items-end">
              {/* 2nd Place */}
              {sorted[1] && (
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center">
                  <span className="text-xs font-bold text-slate-300 mb-1">#2</span>
                  <div className="w-10 h-10 rounded-full bg-slate-500/30 border border-slate-400 flex items-center justify-center text-xs font-bold text-white mb-2">
                    {sorted[1].name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[80px]">
                    {sorted[1].name}
                  </span>
                  <span className="text-[11px] font-mono text-white/60">{sorted[1].score} pts</span>
                </div>
              )}

              {/* 1st Place (Winner Center) */}
              {winner && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/20 to-purple-600/20 border border-amber-500/40 flex flex-col items-center shadow-lg shadow-amber-950/50 scale-105">
                  <Crown size={20} className="text-amber-400 fill-amber-400 mb-1" />
                  <span className="text-xs font-bold text-amber-300 mb-1">Winner</span>
                  <div className="w-12 h-12 rounded-full bg-amber-500 border-2 border-amber-300 flex items-center justify-center text-sm font-bold text-black mb-2 shadow-glow">
                    {winner.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-extrabold text-white truncate max-w-[90px]">
                    {winner.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">{winner.score} pts</span>
                </div>
              )}

              {/* 3rd Place */}
              {sorted[2] && (
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center">
                  <span className="text-xs font-bold text-amber-700 mb-1">#3</span>
                  <div className="w-10 h-10 rounded-full bg-amber-700/30 border border-amber-600 flex items-center justify-center text-xs font-bold text-white mb-2">
                    {sorted[2].name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[80px]">
                    {sorted[2].name}
                  </span>
                  <span className="text-[11px] font-mono text-white/60">{sorted[2].score} pts</span>
                </div>
              )}
            </div>

            {onPlayAgain && (
              <button
                onClick={onPlayAgain}
                className="w-full py-3 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-glow transition-all"
              >
                <RotateCcw size={16} />
                <span>Play Another Match</span>
              </button>
            )}
          </>
        ) : (
          <>
            <div className="inline-flex p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-3">
              <Award size={28} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Turn Ended!</h2>
            <p className="text-xs text-white/50 mt-1">The secret word was:</p>

            <div className="my-4 py-3 px-6 rounded-2xl bg-white/[0.05] border border-white/10 inline-block">
              <span className="text-lg sm:text-2xl font-extrabold font-mono tracking-widest text-emerald-400">
                {revealedWord}
              </span>
            </div>

            <p className="text-xs text-white/40 animate-pulse">
              Next turn starting in 5 seconds...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
