import { Crown, Pencil, CheckCircle2 } from 'lucide-react'
import type { PlayerState } from '../../types/scribble'

interface ScribbleLeaderboardProps {
  players: PlayerState[]
  currentDrawerId?: number
  currentUserId?: number
  currentUserName?: string
}

export default function ScribbleLeaderboard({
  players,
  currentDrawerId,
  currentUserId,
  currentUserName,
}: ScribbleLeaderboardProps) {
  // Sort players strictly by score descending
  const sorted = [...players].sort((a, b) => b.score - a.score)

  // Compute competition rank (#1, #2, #3, tied ranks share same number)
  const getRank = (score: number) => {
    return sorted.findIndex((p) => p.score === score) + 1
  }

  const isSelf = (player: PlayerState) => {
    if (currentUserId && player.userId === currentUserId) return true
    if (currentUserName && player.name && currentUserName.trim().toLowerCase() === player.name.trim().toLowerCase()) return true
    return false
  }

  return (
    <div className="w-full h-full bg-[#13141f]/90 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
        <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase flex items-center gap-1.5">
          <span>Players ({players.length})</span>
        </h3>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          Ranked
        </span>
      </div>

      {/* Players List - Styled precisely like Skribbl.io */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {sorted.map((player) => {
          const rank = getRank(player.score)
          const isDrawer = player.userId === currentDrawerId || player.isDrawing
          const hasGuessed = player.hasGuessed
          const self = isSelf(player)

          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between px-3 py-2 sm:py-2.5 rounded-2xl border transition-all ${
                hasGuessed
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-sm'
                  : isDrawer
                  ? 'bg-purple-600/20 border-purple-400/50 text-purple-200 shadow-sm'
                  : self
                  ? 'bg-white/[0.08] border-purple-500/30 text-white'
                  : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.06] text-white'
              }`}
            >
              {/* Left Side: Rank + Name + Points */}
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                {/* Rank #1, #2, #3, #4... */}
                <div className="flex items-center justify-center w-7 text-xs sm:text-sm font-black font-mono flex-shrink-0">
                  {rank === 1 ? (
                    <div className="flex items-center gap-0.5 text-amber-400">
                      <Crown size={13} className="fill-amber-400 flex-shrink-0" />
                      <span>#1</span>
                    </div>
                  ) : rank === 2 ? (
                    <span className="text-slate-300">#2</span>
                  ) : rank === 3 ? (
                    <span className="text-amber-600">#3</span>
                  ) : (
                    <span className="text-white/40">#{rank}</span>
                  )}
                </div>

                {/* Name & Points (Skribbl style: Username on top, points below) */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs sm:text-sm font-bold truncate max-w-[130px] sm:max-w-[150px] ${self ? 'text-purple-300' : 'text-white'}`}>
                      {player.name}
                    </span>
                    {self && (
                      <span className="text-[10px] font-black text-purple-400 font-mono">
                        (You)
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-white/60 font-mono mt-0.5">
                    {player.score} {player.score === 1 ? 'point' : 'points'}
                  </div>
                </div>
              </div>

              {/* Right Side: Avatar Circle & Status Icon (Just like Skribbl.io) */}
              <div className="relative flex-shrink-0 flex items-center gap-1.5">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-xs sm:text-sm font-black shadow-md border ${
                    hasGuessed
                      ? 'bg-emerald-500 border-emerald-300 text-black'
                      : isDrawer
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-white/20 text-white'
                  }`}
                >
                  {player.name ? player.name.charAt(0).toUpperCase() : 'P'}
                </div>

                {/* Floating Pencil Badge if Drawing */}
                {isDrawer && (
                  <div
                    title="Drawing now"
                    className="absolute -bottom-1 -right-1 p-1 rounded-full bg-purple-600 text-white shadow-md border border-white/40"
                  >
                    <Pencil size={10} />
                  </div>
                )}

                {/* Floating Check Badge if Guessed */}
                {hasGuessed && (
                  <div
                    title="Guessed correctly"
                    className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-black shadow-md border border-emerald-300"
                  >
                    <CheckCircle2 size={10} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
