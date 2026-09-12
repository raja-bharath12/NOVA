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
import ScribbleCanvas, { ScribbleCanvasHandle } from '../components/scribble/ScribbleCanvas'
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
  const [initialActions, setInitialActions] = useState<DrawAction[]>([])
  const [drawerSecretWord, setDrawerSecretWord] = useState<string>('')
  const scribbleCanvasRef = useRef<ScribbleCanvasHandle | null>(null)

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
        if (state.phase === 'LOBBY' || state.phase === 'WORD_SELECTION') {
          setDrawerSecretWord('')
        }
      },
      (action: DrawAction) => {
        // Render remote action directly to canvas context for 60 FPS without React lag
        scribbleCanvasRef.current?.handleRemoteAction(action)
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
        if (privatePayload?.maskedWord && !privatePayload.maskedWord.includes('_')) {
          setDrawerSecretWord(privatePayload.maskedWord)
        }
        if (privatePayload?.currentWord?.word) {
          setDrawerSecretWord(privatePayload.currentWord.word)
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
    setDrawerSecretWord(word.toUpperCase())
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

  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false)

  const handleRestartGame = () => {
    if (!roomCode || !isHost) return
    websocketService.sendScribbleRestart(roomCode)
    showToast('Match returned to lobby!', 'info')
  }

  const handleConfirmEndGame = () => {
    if (!roomCode || !isHost) return
    websocketService.sendScribbleEndGame(roomCode)
    setShowEndGameConfirm(false)
    showToast('Game ended by host.', 'info')
  }

  const handleClear = () => {
    if (!roomCode || !isDrawer) return
    scribbleCanvasRef.current?.clear()
    const clearAction: DrawAction = { type: 'CLEAR', timestamp: Date.now() }
    websocketService.sendScribbleDraw(roomCode, clearAction)
  }

  const handleUndo = () => {
    if (!roomCode || !isDrawer) return
    scribbleCanvasRef.current?.undo()
    const undoAction: DrawAction = { type: 'UNDO', timestamp: Date.now() }
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

  // Word display computations
  const effectiveDrawerWord = drawerSecretWord || (roomState.maskedWord && !roomState.maskedWord.includes('_') ? roomState.maskedWord : '')
  const drawerWordLength = effectiveDrawerWord ? effectiveDrawerWord.replace(/[^a-zA-Z0-9]/g, '').length : (roomState.wordLength || 0)
  const guesserWordLength = roomState.wordLength || roomState.maskedWord.replace(/\s+/g, '').length

  return (
    <div className="w-full flex flex-col space-y-3 pb-8 max-w-[1600px] mx-auto min-h-[calc(100dvh-5rem)]">
      {/* 1. TOP GAME STATUS BAR (Styled like Skribbl.io) */}
      <div className="w-full bg-[#13141f]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 sm:p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Round Clock Circle & Round Info */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {roomState.phase !== 'LOBBY' ? (
            <div
              className={`relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 text-white font-black font-mono text-sm sm:text-base shadow-md transition-all ${
                roomState.timeRemaining <= 5
                  ? 'bg-rose-500/30 border-rose-400 animate-pulse text-rose-200'
                  : roomState.timeRemaining <= 10
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                  : 'bg-purple-600/30 border-purple-400 text-purple-200'
              }`}
            >
              <span>{roomState.timeRemaining}</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono">
              LOBBY
            </div>
          )}

          <div>
            <span className="text-xs sm:text-sm font-black text-white block leading-tight">
              Round {roomState.currentRound} of {roomState.totalRounds}
            </span>
            <span className="text-[10px] text-white/50 block font-mono">
              {roomState.phase === 'LOBBY' ? 'Waiting for players' : `Turn ${roomState.currentTurnIndex + 1}`}
            </span>
          </div>
        </div>

        {/* Word Clue Mask / Reveal Center: GUESS THIS vs DRAW THIS */}
        <div className="flex-1 flex flex-col items-center justify-center px-2">
          {roomState.phase === 'LOBBY' ? (
            <span className="text-xs sm:text-sm font-bold text-purple-300 uppercase tracking-widest text-center">
              Room Code: {roomState.roomCode}
            </span>
          ) : isDrawer ? (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-[10px] sm:text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1">
                🎨 DRAW THIS:
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base sm:text-2xl font-mono font-black text-white tracking-widest uppercase bg-purple-500/10 px-3 py-0.5 rounded-xl border border-purple-500/20">
                  {effectiveDrawerWord || roomState.maskedWord || 'Choosing...'}
                </span>
                {drawerWordLength > 0 && (
                  <span className="text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono">
                    {drawerWordLength} letters
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-[10px] sm:text-xs text-white/60 font-black uppercase tracking-wider flex items-center gap-1">
                🎨 GUESS THIS:
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base sm:text-2xl font-mono font-black text-white tracking-[0.25em]">
                  {roomState.maskedWord}
                </span>
                {guesserWordLength > 0 && (
                  <span className="text-xs font-black text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-mono">
                    {guesserWordLength} letters
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Score Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Score Badge */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono shadow-sm">
            <Trophy size={14} className="text-amber-400" />
            <span>{currentUserPlayer?.score || 0} PTS</span>
          </div>

          <button
            onClick={handleCopyInvite}
            title="Copy Invite Link"
            className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-white/5 transition-all active:scale-95"
          >
            <Share2 size={14} />
            <span className="hidden md:inline">Invite</span>
          </button>

          {isHost && roomState.phase !== 'LOBBY' && (
            <button
              onClick={() => setShowEndGameConfirm(true)}
              title="End Match for Everyone"
              className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Flag size={14} />
              <span className="hidden md:inline">End Game</span>
            </button>
          )}

          <button
            onClick={handleLeave}
            title="Leave Match"
            className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
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
                Invite friends with the room code or link. When ready, the host starts the game!
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
                    <span>START GAME</span>
                  </button>
                ) : (
                  <div className="text-xs text-purple-300 font-semibold animate-pulse text-center sm:text-left py-2">
                    Waiting for host ({roomState.hostName || 'Host'}) to start game...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Lobby Chat Feed */}
          <div className="h-[400px] lg:h-auto">
            <ScribbleChat
              messages={messages}
              onSendMessage={handleSendMessage}
              hasGuessed={false}
              isDrawer={false}
              currentUserId={effectiveUserId}
              currentUserName={user?.name}
            />
          </div>
        </div>
      ) : (
        /* ACTIVE GAME ARENA - THREE-COLUMN LAYOUT (LEADERBOARD | CANVAS | CHAT) */
        <div className="w-full flex-1 flex flex-col space-y-3">
          {/* Inline Word Selection Banner (For Drawer during 10s WORD_SELECTION) */}
          {roomState.phase === 'WORD_SELECTION' && isDrawer && (
            <div className="w-full bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-900/60 border border-purple-500/30 rounded-2xl p-3 sm:p-4 backdrop-blur-xl shadow-glow">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    CHOOSE YOUR WORD ({roomState.timeRemaining}s):
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
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm sm:text-base shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2 border border-purple-400/40"
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

          {/* Announcement if another player is choosing */}
          {roomState.phase === 'WORD_SELECTION' && !isDrawer && (
            <div className="w-full py-2.5 px-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center text-xs font-semibold text-purple-300 animate-pulse">
              🎨 {roomState.currentDrawerName || 'Drawer'} is choosing a word... ({roomState.timeRemaining}s)
            </div>
          )}

          {/* Responsive 3-Column Layout: Scoreboard on Left | Canvas in Middle | Chat on Right */}
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[520px]">
            {/* 1. Left Column: Scoreboard with Avatars, Points, and Guessed Status (ALWAYS VISIBLE on md+) */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 h-[220px] md:h-auto">
              <ScribbleLeaderboard
                players={roomState.players}
                currentDrawerId={roomState.currentDrawerId}
                currentUserId={effectiveUserId}
                currentUserName={user?.name || localStorage.getItem('mystic_scribble_name') || ''}
              />
            </div>

            {/* 2. Center Column: Whiteboard Canvas + Drawer Toolbar */}
            <div className="col-span-12 md:col-span-8 lg:col-span-6 flex flex-col gap-2 min-h-[340px] sm:min-h-[440px] lg:min-h-[540px]">
              <div className="flex-1 relative w-full h-[280px] sm:h-[380px] lg:h-full">
                <ScribbleCanvas
                  ref={scribbleCanvasRef}
                  isDrawer={isDrawer && roomState.phase === 'DRAWING'}
                  currentTool={currentTool}
                  currentColor={currentColor}
                  currentWidth={currentWidth}
                  onEmitDrawAction={handleEmitDrawAction}
                  initialActions={initialActions}
                />
              </div>

              {/* Drawer Tools (Displayed if Drawer during DRAWING) */}
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
            </div>

            {/* 3. Right Column: Live Chat & Guess Feed */}
            <div className="col-span-12 lg:col-span-3 h-[320px] sm:h-[380px] lg:h-auto flex flex-col">
              <ScribbleChat
                messages={messages}
                onSendMessage={handleSendMessage}
                hasGuessed={hasGuessed}
                isDrawer={isDrawer && roomState.phase === 'DRAWING'}
                currentUserId={effectiveUserId}
                currentUserName={user?.name}
              />
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
        onPlayAgain={isHost ? handleRestartGame : undefined}
      />

      {/* Host End Game Confirmation Modal */}
      {showEndGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#141523] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-2">End Game?</h3>
            <p className="text-xs text-white/60 mb-6 leading-relaxed">
              This will end the game match for everyone in the room.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowEndGameConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndGame}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40"
              >
                End Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
