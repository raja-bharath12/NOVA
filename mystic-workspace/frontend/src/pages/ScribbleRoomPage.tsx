import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Palette,
  Clock,
  Share2,
  Flag,
  LogOut,
  Play,
  Copy,
  Users,
  Sparkles,
  HelpCircle,
  Crown,
  Trophy,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import scribbleService from '../services/scribbleService'
import websocketService from '../services/websocketService'
import ScribbleCanvas from '../components/scribble/ScribbleCanvas'
import ScribbleToolbar from '../components/scribble/ScribbleToolbar'
import ScribbleLeaderboard from '../components/scribble/ScribbleLeaderboard'
import ScribbleChat from '../components/scribble/ScribbleChat'
import ScribbleWordPickerModal from '../components/scribble/ScribbleWordPickerModal'
import ScribbleEndRoundModal from '../components/scribble/ScribbleEndRoundModal'
import type {
  RoomState,
  DrawAction,
  ScribbleChatMessage,
  WordOption,
} from '../types/scribble'

export default function ScribbleRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ScribbleChatMessage[]>([])
  const [incomingAction, setIncomingAction] = useState<DrawAction | null>(null)
  const [initialActions, setInitialActions] = useState<DrawAction[]>([])

  // Drawer local tool state
  const [currentTool, setCurrentTool] = useState<'brush' | 'pencil' | 'eraser' | 'fill'>('brush')
  const [currentColor, setCurrentColor] = useState<string>('#000000')
  const [currentWidth, setCurrentWidth] = useState<number>(7)

  // Drawer private word choices
  const [drawerWordChoices, setDrawerWordChoices] = useState<WordOption[]>([])

  const effectiveUserId = user?.id || 9999
  const isHost =
    roomState?.hostId === effectiveUserId ||
    Boolean(roomState?.players?.some((p) => p.userId === effectiveUserId && p.isHost)) ||
    Boolean(roomState?.players?.length && roomState.players[0].userId === effectiveUserId) ||
    Boolean(user?.name && roomState?.hostName && user.name.trim().toLowerCase() === roomState.hostName.trim().toLowerCase()) ||
    Boolean(user?.name && roomState?.players?.[0] && user.name.trim().toLowerCase() === roomState.players[0].name.trim().toLowerCase()) ||
    Boolean(roomState?.players?.length === 1)

  const isDrawer =
    roomState?.currentDrawerId === effectiveUserId ||
    Boolean(roomState?.players?.length === 1) ||
    Boolean(user?.name && roomState?.currentDrawerName && user.name.trim().toLowerCase().includes(roomState.currentDrawerName.trim().toLowerCase())) ||
    Boolean(user?.name && roomState?.currentDrawerName && roomState.currentDrawerName.trim().toLowerCase().includes(user.name.trim().toLowerCase()))

  // Check if current user already guessed this turn
  const currentUserPlayer = roomState?.players.find((p) => p.userId === effectiveUserId)
  const hasGuessed = currentUserPlayer?.hasGuessed || false

  // 1. Initial Room Data & Snapshot Fetch
  useEffect(() => {
    if (!roomCode) return

    const token = localStorage.getItem('mystic_token') || ''
    websocketService.connect(token)

    const loadRoom = async () => {
      try {
        setLoading(true)
        const state = await scribbleService.joinRoom(roomCode, {
          playerName: user?.name,
          userTag: user?.userTag,
        })
        setRoomState(state)

        const snapshot = await scribbleService.getCanvasSnapshot(roomCode)
        setInitialActions(snapshot)
      } catch (err) {
        showToast('Room not found or unable to join', 'warning')
        navigate('/scribble')
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomCode, user, navigate, showToast])

  // 2. STOMP WebSocket Subscriptions
  useEffect(() => {
    if (!roomCode) return

    const unsubscribe = websocketService.subscribeToScribbleRoom(
      roomCode,
      user?.id,
      (state: RoomState) => {
        setRoomState(state)
        if (state.wordChoices && state.wordChoices.length > 0) {
          setDrawerWordChoices(state.wordChoices)
        }
      },
      (action: DrawAction) => {
        setIncomingAction(action)
      },
      (chatMsg: ScribbleChatMessage) => {
        setMessages((prev) => [...prev, chatMsg])
      },
      (privatePayload: any) => {
        if (privatePayload?.wordChoices) {
          setDrawerWordChoices(privatePayload.wordChoices)
        } else if (privatePayload?.type === 'CLOSE_GUESS') {
          setMessages((prev) => [...prev, privatePayload])
        }
      },
      (timerData) => {
        setRoomState((prev) => (prev ? { ...prev, timeRemaining: timerData.timeRemaining } : prev))
      }
    )

    return () => {
      unsubscribe()
    }
  }, [roomCode, user?.id])

  // Actions
  const handleEmitDrawAction = (action: DrawAction) => {
    if (!roomCode) return
    websocketService.sendScribbleDraw(roomCode, action)
  }

  const handleSendMessage = (text: string) => {
    if (!roomCode) return
    websocketService.sendScribbleGuess(roomCode, text)
  }

  const handleSelectWord = (word: string) => {
    if (!roomCode) return
    websocketService.sendScribbleSelectWord(roomCode, word)
    setDrawerWordChoices([])
  }

  const handleStartGame = () => {
    if (!roomCode) return
    websocketService.sendScribbleStartGame(roomCode)
    showToast('Starting match arena!', 'success')
  }

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/scribble/room/${roomCode}`
    navigator.clipboard.writeText(url)
    showToast('Room invite link copied to clipboard!', 'success')
  }

  const handleLeave = () => {
    if (roomCode) websocketService.sendScribbleLeave(roomCode)
    navigate('/scribble')
  }

  const handleClear = () => {
    if (!roomCode || !isDrawer) return
    const clearAction: DrawAction = { type: 'CLEAR', timestamp: Date.now() }
    setIncomingAction(clearAction)
    websocketService.sendScribbleDraw(roomCode, clearAction)
  }

  const handleUndo = () => {
    if (!roomCode || !isDrawer) return
    const undoAction: DrawAction = { type: 'UNDO', timestamp: Date.now() }
    setIncomingAction(undoAction)
    websocketService.sendScribbleDraw(roomCode, undoAction)
  }

  if (loading || !roomState) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center animate-spin">
          <Palette className="w-6 h-6 text-purple-400" />
        </div>
        <p className="text-sm font-semibold text-white/60">Connecting to Scribble Arena...</p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col space-y-3 pb-8 max-w-[1600px] mx-auto min-h-[calc(100dvh-5rem)]">
      {/* 1. TOP GAME STATUS BAR */}
      <div className="w-full bg-[#13141f]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Round & Drawer Info */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono">
            Round {roomState.currentRound} / {roomState.totalRounds}
          </div>

          <div className="hidden sm:block">
            <span className="text-xs text-white/50 block">Active Drawer:</span>
            <span className="text-xs sm:text-sm font-bold text-silver">
              {roomState.currentDrawerName || 'Waiting in Lobby'}
            </span>
          </div>
        </div>

        {/* Word Clue Mask / Reveal Center */}
        <div className="flex-1 flex flex-col items-center justify-center px-2">
          {roomState.phase === 'LOBBY' ? (
            <span className="text-xs sm:text-sm font-bold text-purple-300 uppercase tracking-widest">
              Lobby Room • Waiting for Host
            </span>
          ) : isDrawer ? (
            <div className="text-center">
              <span className="text-sm sm:text-lg font-mono font-black text-purple-300 tracking-widest uppercase">
                {roomState.maskedWord}
              </span>
              {roomState.wordHint && (
                <span className="text-[11px] text-white/50 block">({roomState.wordHint})</span>
              )}
            </div>
          ) : (
            <div className="text-center">
              <span className="text-base sm:text-2xl font-mono font-black text-white tracking-[0.25em]">
                {roomState.maskedWord}
              </span>
              <span className="text-[10px] text-white/40 block mt-0.5">
                {roomState.wordLength} letters
              </span>
            </div>
          )}
        </div>

        {/* Turn Timer, Live Score & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Score Badge (Always Visible on Mobile & Desktop) */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono shadow-sm">
            <Trophy size={14} className="text-amber-400" />
            <span>{currentUserPlayer?.score || 0} PTS</span>
          </div>

          {roomState.phase !== 'LOBBY' && (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-500/30 text-xs font-mono font-bold">
              <Clock size={14} className="animate-pulse text-purple-400" />
              <span>00:{roomState.timeRemaining.toString().padStart(2, '0')}</span>
            </div>
          )}

          <button
            onClick={handleCopyInvite}
            title="Copy Invite Link"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-white/5 transition-all active:scale-95"
          >
            <Share2 size={14} />
            <span className="hidden md:inline">Invite</span>
          </button>

          <button
            onClick={handleLeave}
            title="Leave Match"
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN ARENA CONTENT (LOBBY VS ACTIVE GAMEPLAY) */}
      {roomState.phase === 'LOBBY' ? (
        <div className="w-full flex-1 min-h-[500px] grid lg:grid-cols-3 gap-4">
          {/* Left / Center: Lobby Roster & Host Launch */}
          <div className="lg:col-span-2 bg-[#13141f]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-mono text-purple-400 block mb-1">
                    Room Code: {roomState.roomCode}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">{roomState.title}</h2>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold">
                  <Users size={14} />
                  <span>{roomState.players.length} Players</span>
                </div>
              </div>

              <p className="text-xs text-white/60 mb-6 max-w-xl leading-relaxed">
                Invite other players to join using the room code or dynamic link. Once everyone is in
                the room, the host can launch the match!
              </p>

              {/* Player Roster Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {roomState.players.map((p) => (
                  <div
                    key={p.userId}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white block truncate">
                        {p.name}
                      </span>
                      {p.isHost && (
                        <span className="text-[9px] font-bold uppercase text-amber-400 flex items-center gap-0.5">
                          <Crown size={9} /> Host
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Start Match Button */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Only visible on tablet/desktop, hidden on mobile */}
              <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
                <Copy size={14} />
                <span className="truncate max-w-[280px]">Link: {window.location.origin}/scribble/room/{roomState.roomCode}</span>
              </div>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                {isHost ? (
                  <button
                    onClick={handleStartGame}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-400 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Play size={18} className="fill-current" />
                    <span>Start Game Match</span>
                  </button>
                ) : (
                  <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-purple-300 font-semibold animate-pulse text-center sm:text-left">
                      Waiting for host ({roomState.hostName || 'Host'}) to start match...
                    </div>
                    <button
                      onClick={handleStartGame}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <Play size={14} className="fill-current" />
                      <span>Start Match Now</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Lobby Chat Feed */}
          <div className="h-[450px] lg:h-auto">
            <ScribbleChat
              messages={messages}
              onSendMessage={handleSendMessage}
              hasGuessed={false}
              isDrawer={false}
            />
          </div>
        </div>
      ) : (
        /* ACTIVE GAME ARENA */
        <div className="w-full flex-1 flex flex-col space-y-3">
          {/* Inline Word Selection Banner (For Drawer during WORD_SELECTION) */}
          {roomState.phase === 'WORD_SELECTION' && isDrawer && (
            <div className="w-full bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-900/60 border border-purple-500/30 rounded-2xl p-3 sm:p-4 backdrop-blur-xl shadow-glow animate-pulse">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Pick a word to start drawing (00:{roomState.timeRemaining.toString().padStart(2, '0')}):
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {(drawerWordChoices.length > 0 ? drawerWordChoices : [
                    { word: 'SUN', difficulty: 'EASY' as const, hint: 'Sky' },
                    { word: 'CASTLE', difficulty: 'MEDIUM' as const, hint: 'Building' },
                    { word: 'ASTRONAUT', difficulty: 'HARD' as const, hint: 'Space' }
                  ]).map((w) => (
                    <button
                      key={w.word}
                      onClick={() => handleSelectWord(w.word)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border border-purple-400/40"
                    >
                      <span>{w.word}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 uppercase font-mono text-purple-200">
                        {w.difficulty}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Desktop 3-Column / Mobile Responsive Grid */}
          <div className="w-full grid lg:grid-cols-12 gap-3 min-h-[550px]">
            {/* 1. Left Column on Desktop: Leaderboard (Hidden on Mobile unless tab selected) */}
            <div className="hidden lg:block lg:col-span-3 h-auto">
              <ScribbleLeaderboard
                players={roomState.players}
                currentDrawerId={roomState.currentDrawerId}
              />
            </div>

            {/* 2. Center Column: Interactive Canvas & Toolbar (Always Prominent at Top on Mobile) */}
            <div className="lg:col-span-6 flex flex-col gap-2 min-h-[360px] sm:min-h-[440px] lg:min-h-[520px]">
              <div className="flex-1 relative w-full h-full min-h-[300px] sm:min-h-[400px]">
                <ScribbleCanvas
                  isDrawer={isDrawer && roomState.phase === 'DRAWING'}
                  currentTool={currentTool}
                  currentColor={currentColor}
                  currentWidth={currentWidth}
                  onEmitDrawAction={handleEmitDrawAction}
                  incomingAction={incomingAction}
                  initialActions={initialActions}
                />
              </div>

              {/* Drawer Tools (Paintbrush, Pencil, Eraser, Flood Fill Bucket, Colors, Sizes) */}
              {(isDrawer || roomState.players.length === 1) && (
                <div className="w-full">
                  <ScribbleToolbar
                    currentTool={currentTool}
                    setTool={setCurrentTool}
                    currentColor={currentColor}
                    setColor={setCurrentColor}
                    currentWidth={currentWidth}
                    setWidth={setCurrentWidth}
                    onClear={handleClear}
                    onUndo={handleUndo}
                  />
                </div>
              )}
            </div>

            {/* 3. Right Column on Desktop: Live Chat & Guess Feed */}
            <div className="hidden lg:block lg:col-span-3 h-auto">
              <ScribbleChat
                messages={messages}
                onSendMessage={handleSendMessage}
                hasGuessed={hasGuessed}
                isDrawer={isDrawer && roomState.phase === 'DRAWING'}
              />
            </div>
          </div>

          {/* Mobile Screen: Whiteboard Canvas + Keyboard-Ready Guess Bar */}
          <div className="block lg:hidden w-full flex flex-col space-y-2">
            {/* Whiteboard Canvas */}
            <div className="w-full h-[250px] sm:h-[320px] relative">
              <ScribbleCanvas
                isDrawer={isDrawer && roomState.phase === 'DRAWING'}
                currentTool={currentTool}
                currentColor={currentColor}
                currentWidth={currentWidth}
                onEmitDrawAction={handleEmitDrawAction}
                incomingAction={incomingAction}
                initialActions={initialActions}
              />
            </div>

            {/* Drawer Tools (If Drawer) */}
            {(isDrawer || roomState.players.length === 1) && roomState.phase === 'DRAWING' && (
              <div className="w-full">
                <ScribbleToolbar
                  currentTool={currentTool}
                  setTool={setCurrentTool}
                  currentColor={currentColor}
                  setColor={setCurrentColor}
                  currentWidth={currentWidth}
                  setWidth={setCurrentWidth}
                  onClear={handleClear}
                  onUndo={handleUndo}
                />
              </div>
            )}

            {/* Mobile Guess Input & Recent Messages (Whiteboard stays in full view while typing!) */}
            <div className="w-full bg-[#13141f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 shadow-xl flex flex-col gap-2">
              {/* Mini Recent Guesses Strip */}
              <div className="max-h-[65px] overflow-y-auto space-y-1 text-xs px-1 custom-scrollbar">
                {messages.length === 0 ? (
                  <span className="text-white/40 text-[11px] italic">Live guesses and hints will appear here...</span>
                ) : (
                  messages.slice(-4).map((m) => (
                    <div key={m.id} className="truncate">
                      {m.type === 'CORRECT_GUESS' ? (
                        <span className="text-emerald-400 font-bold">🎉 {m.content} (+{m.pointsEarned} pts)</span>
                      ) : m.type === 'CLOSE_GUESS' ? (
                        <span className="text-amber-400 font-semibold animate-pulse">⚠️ {m.content}</span>
                      ) : (
                        <span className="text-white/80"><b className="text-silver mr-1">{m.senderName}:</b>{m.content}</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Mobile Typing Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const inputEl = form.elements.namedItem('mobileGuess') as HTMLInputElement
                  if (inputEl && inputEl.value.trim()) {
                    handleSendMessage(inputEl.value.trim())
                    inputEl.value = ''
                  }
                }}
                className="flex gap-2 w-full"
              >
                <input
                  name="mobileGuess"
                  type="text"
                  autoComplete="off"
                  disabled={hasGuessed || (isDrawer && roomState.phase === 'DRAWING')}
                  placeholder={
                    isDrawer && roomState.phase === 'DRAWING'
                      ? 'You are drawing! Chat disabled'
                      : hasGuessed
                      ? '✓ Correct! You solved it'
                      : 'Type your answer here...'
                  }
                  className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={hasGuessed || (isDrawer && roomState.phase === 'DRAWING')}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-center transition-all disabled:opacity-40 active:scale-95 shadow-glow"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Mobile Live Scores Bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
              <span className="text-white/60 font-semibold flex items-center gap-1">
                <Trophy size={12} className="text-amber-400" /> Scores:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                {roomState.players.map((p, idx) => (
                  <span key={p.userId} className="font-mono text-[11px] text-white/80 whitespace-nowrap">
                    #{idx + 1} {p.name}: <b className="text-purple-300">{p.score}p</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODALS */}
      {/* Drawer Word Selection Modal */}
      <ScribbleWordPickerModal
        isOpen={isDrawer && roomState.phase === 'WORD_SELECTION'}
        wordChoices={drawerWordChoices}
        timeRemaining={roomState.timeRemaining}
        onSelectWord={handleSelectWord}
      />

      {/* Round End Intermission & Game Over Podium */}
      <ScribbleEndRoundModal
        phase={roomState.phase}
        revealedWord={roomState.lastRevealedWord || ''}
        players={roomState.players}
        onPlayAgain={isHost ? handleStartGame : undefined}
      />
    </div>
  )
}
