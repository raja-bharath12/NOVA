import { Crown, Pencil, CheckCircle2, Trophy } from 'lucide-react'
import type { PlayerState } from '../../types/scribble'

interface ScribbleLeaderboardProps {
  players: PlayerState[]
  currentDrawerId?: number
}

export default function ScribbleLeaderboard({ players, currentDrawerId }: ScribbleLeaderboardProps) {
  // Sort players by total score descending
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="w-full h-full bg-[#13141f]/80 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col shadow-xl overflow-hidden">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
            Leaderboard
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/5">
          {players.length} Players
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {sorted.map((player, idx) => {
          const isDrawer = player.userId === currentDrawerId || player.isDrawing
          const hasGuessed = player.hasGuessed

          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between p-2 sm:p-2.5 rounded-2xl border transition-all ${
                hasGuessed
                  ? 'bg-emerald-500/15 border-emerald-500/30'
                  : isDrawer
                  ? 'bg-purple-500/15 border-purple-500/30'
                  : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Rank indicator */}
                <div className="flex items-center justify-center w-5 text-xs font-bold font-mono">
                  {idx === 0 ? (
                    <Crown size={15} className="text-amber-400 fill-amber-400" />
                  ) : idx === 1 ? (
                    <span className="text-slate-300">#2</span>
                  ) : idx === 2 ? (
                    <span className="text-amber-600">#3</span>
                  ) : (
                    <span className="text-white/40">#{idx + 1}</span>
                  )}
                </div>

                {/* Avatar / Initial */}
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                    {player.name ? player.name.charAt(0).toUpperCase() : 'P'}
                  </div>
                  {isDrawer && (
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-purple-600 text-white shadow-md">
                      <Pencil size={10} />
                    </div>
                  )}
                  {hasGuessed && (
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-emerald-500 text-white shadow-md">
                      <CheckCircle2 size={10} />
                    </div>
                  )}
                </div>

                {/* Name & status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-silver truncate">
                      {player.name}
                    </span>
                    {player.isHost && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/40 truncate">
                    {isDrawer ? (
                      <span className="text-purple-300 font-medium">✏️ Drawing</span>
                    ) : hasGuessed ? (
                      <span className="text-emerald-400 font-medium">🎉 Guessed! (+{player.roundScore})</span>
                    ) : (
                      <span>@{player.userTag || 'player'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Score */}
              <div className="text-right flex-shrink-0 pl-2">
                <span className="text-xs sm:text-sm font-mono font-bold text-white block">
                  {player.score}
                </span>
                <span className="text-[9px] text-white/40 uppercase tracking-wider">pts</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
