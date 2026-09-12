export type GamePhase = 'LOBBY' | 'WORD_SELECTION' | 'DRAWING' | 'ROUND_END' | 'GAME_OVER'

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface WordOption {
  word: string
  difficulty: Difficulty
  hint: string
}

export interface PlayerState {
  userId: number
  name: string
  avatar?: string
  userTag?: string
  score: number
  roundScore: number
  isHost: boolean
  isDrawing: boolean
  hasGuessed: boolean
  guessTimeRemaining?: number
  isConnected: boolean
}

export interface RoomSettings {
  roundCount: number
  turnDurationSeconds: number
  maxPlayers: number
  customWordsOnly: boolean
  isPublic: boolean
}

export interface RoomState {
  roomCode: string
  title: string
  hostId: number
  hostName: string
  phase: GamePhase
  currentRound: number
  totalRounds: number
  currentTurnIndex: number
  currentDrawerId?: number
  currentDrawerName?: string
  maskedWord: string
  wordLength: number
  wordHint?: string
  timeRemaining: number
  totalTurnSeconds: number
  players: PlayerState[]
  settings: RoomSettings
  wordChoices?: WordOption[]
  lastRevealedWord?: string
}

export interface DrawPoint {
  x: number // Normalized 0.0 to 1.0
  y: number // Normalized 0.0 to 1.0
}

export type DrawActionType = 'START' | 'STROKE' | 'END' | 'FILL' | 'CLEAR' | 'UNDO'

export interface DrawAction {
  type: DrawActionType
  points?: DrawPoint[]
  color?: string
  width?: number
  tool?: 'brush' | 'pencil' | 'eraser' | 'fill'
  fillPoint?: DrawPoint
  timestamp?: number
  senderId?: number
}

export type ScribbleMsgType =
  | 'CHAT'
  | 'SYSTEM'
  | 'CORRECT_GUESS'
  | 'CLOSE_GUESS'
  | 'PLAYER_JOIN'
  | 'PLAYER_LEAVE'
  | 'DRAWER_PICKED'

export interface ScribbleChatMessage {
  id: string
  type: ScribbleMsgType
  senderId?: number
  senderName?: string
  senderTag?: string
  content: string
  pointsEarned?: number
  timestamp: number
  isPrivate?: boolean
}

export interface CreateRoomPayload {
  title?: string
  roundCount?: number
  turnDurationSeconds?: number
  maxPlayers?: number
  isPublic?: boolean
}

export interface JoinRoomPayload {
  playerName?: string
  avatar?: string
  userTag?: string
}
