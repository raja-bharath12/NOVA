export interface User {
  id: number
  name: string
  email: string
  userTag?: string
  role?: 'ADMIN' | 'USER'
  createdAt?: string
  status?: 'ONLINE' | 'AWAY' | 'OFFLINE'
  connectionStatus?: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'CONNECTED'
  connectionId?: number
}

export interface UserConnection {
  id: number
  requester: User
  recipient: User
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: string
  updatedAt: string
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Task {
  id?: number
  title: string
  description?: string
  priority: Priority
  category?: string
  deadline?: string // ISO date (yyyy-MM-dd)
  completed: boolean
  createdAt?: string // ISO timestamp from backend
}


export interface EventItem {
  id?: number
  title: string
  description?: string
  startTime: string // ISO instant
  endTime: string
  location?: string
  meetingLink?: string
  participants?: string
}

export interface FileItem {
  id: number
  originalFilename: string
  storageKey: string
  mimeType: string
  fileSize: number
  storageType: 'LOCAL' | 'S3'
  owner?: User
  conversationId?: number
  messageId?: number
  isShared: boolean
  createdAt: string
  downloadUrl: string
}

export interface Message {
  id: number
  conversationId: number
  sender: User
  content: string
  replyToId?: number
  replyToContent?: string
  replyToSenderName?: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  attachments: FileItem[]
  readByUserIds: number[]
  isDelivered: boolean
  isRead: boolean
}

export interface Conversation {
  id: number
  type: 'DIRECT' | 'GROUP'
  title: string
  createdBy?: User
  createdAt: string
  updatedAt: string
  members: User[]
  lastMessage?: Message
  unreadCount: number
  userRole?: 'ADMIN' | 'MEMBER'
}

export interface MeetingParticipant {
  id: number
  user: User
  role: 'HOST' | 'PARTICIPANT'
  joinedAt: string
  leftAt?: string
}

export interface Meeting {
  id: number
  roomCode: string
  title: string
  description?: string
  host: User
  scheduledStartTime?: string
  status: 'WAITING' | 'ACTIVE' | 'ENDED'
  createdAt: string
  startedAt?: string
  endedAt?: string
  participants: MeetingParticipant[]
}

export interface CallSignal {
  type:
    | 'CALL_REQUEST'
    | 'CALL_ACCEPT'
    | 'CALL_REJECT'
    | 'CALL_BUSY'
    | 'CALL_END'
    | 'OFFER'
    | 'ANSWER'
    | 'ICE_CANDIDATE'
    | 'CANDIDATE'
    | 'HANGUP'
  senderId: number
  senderName: string
  targetUserId: number
  isVideo: boolean
  sdp?: any
  candidate?: any
  callId?: string
}

export interface MeetingSignal {
  type:
    | 'JOIN'
    | 'LEAVE'
    | 'OFFER'
    | 'ANSWER'
    | 'ICE_CANDIDATE'
    | 'SCREEN_SHARE_START'
    | 'SCREEN_SHARE_STOP'
    | 'HAND_RAISE'
    | 'CHAT_MESSAGE'
    | 'WHITEBOARD_OPEN'
    | 'WHITEBOARD_CLOSE'
    | 'WHITEBOARD_REQUEST_ACCESS'
    | 'WHITEBOARD_GRANT_ACCESS'
    | 'WHITEBOARD_REVOKE_ACCESS'
    | 'WHITEBOARD_DENY_ACCESS'
    | 'WHITEBOARD_SYNC'
  roomCode: string
  senderId: number
  senderName: string
  targetUserId?: number
  sdp?: any
  candidate?: any
  isScreenSharing?: boolean
  isHandRaised?: boolean
  isWhiteboardOpen?: boolean
  allowedUserIds?: number[]
  chatContent?: string
  timestamp?: string
}

export interface TypingEvent {
  conversationId: number
  userId: number
  userName: string
  isTyping: boolean
}

export interface PresenceEvent {
  userId: number
  userName: string
  status: 'ONLINE' | 'AWAY' | 'OFFLINE'
  timestamp: string
}

export interface ReadReceiptEvent {
  conversationId: number
  messageId: number
  userId: number
  readAt: string
}

// ===== STAGE 4 TYPES =====

export interface WhiteboardPoint {
  x: number
  y: number
}

export type WhiteboardTool = 'PEN' | 'ERASER' | 'LINE' | 'RECTANGLE' | 'CIRCLE' | 'ARROW' | 'TEXT' | 'CLEAR'

export interface WhiteboardOp {
  id?: string
  tool: WhiteboardTool
  color?: string
  strokeWidth?: number
  points?: WhiteboardPoint[]
  x?: number
  y?: number
  endX?: number
  endY?: number
  text?: string
  fontSize?: number
  userId?: number
  userName?: string
  timestamp?: string
}

export interface WhiteboardCursor {
  userId: number
  userName: string
  color: string
  x: number
  y: number
  isDrawing?: boolean
}

export interface WhiteboardItem {
  id: number
  title: string
  creator: User
  meetingRoomCode?: string
  canvasData?: string
  snapshotUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AiChatMessage {
  role: 'USER' | 'ASSISTANT'
  content: string
  timestamp?: string
}

export interface AiTaskSuggestion {
  title: string
  description?: string
  priority: Priority
  category?: string
  estimatedMinutes?: number
  deadline?: string
}

export interface AiActionItem {
  task: string
  assignee?: string
  deadline?: string
}

export interface AiMeetingSummary {
  meetingId: number
  meetingTitle: string
  summary: string
  keyDecisions: string[]
  actionItems: AiActionItem[]
  generatedAt: string
}

export interface AiProductivityAnalytics {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  upcomingDeadlines?: number
  totalMeetings?: number
  overdueTasks?: number
  completionRate: number
  productivityInsight?: string
  focusScore?: number
  weeklyVelocity?: number
  aiRecommendations?: string[]
  burnoutRisk?: 'LOW' | 'MODERATE' | 'HIGH'
}

export interface GlobalSearchResult {
  query: string
  totalCount: number
  tasks: Task[]
  events: EventItem[]
  messages: Message[]
  files: FileItem[]
  meetings: Meeting[]
  whiteboards: WhiteboardItem[]
}

export interface AppNotification {
  id: string
  type: 'MESSAGE' | 'CALENDAR_EVENING' | 'CALENDAR_MORNING' | 'CALL' | 'TASK' | 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED'
  title: string
  body: string
  targetUrl?: string
  senderName?: string
  createdAt: string
  read?: boolean
  eventId?: number
  conversationId?: number
  connectionId?: number
  requesterId?: number
}

// ===== WATCH TOGETHER TYPES =====

export interface WatchMedia {
  id: number
  title: string
  originalFilename: string
  storageKey: string
  mimeType: string
  fileSize: number
  duration?: number
  thumbnailUrl?: string
  manifestUrl?: string
  streamUrl: string
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  ownerId: number
  ownerName: string
  createdAt: string
}

export interface WatchRoomMemberInfo {
  userId: number
  name: string
  email: string
  userTag?: string
  role: 'HOST' | 'PARTICIPANT'
  joinedAt: string
}

export interface WatchRoom {
  id: number
  roomCode: string
  title: string
  status: 'WAITING' | 'ACTIVE' | 'ENDED'
  media: WatchMedia
  hostId: number
  hostName: string
  currentPosition: number
  isPlaying: boolean
  playbackRate: number
  lastSyncedAt: string
  members: WatchRoomMemberInfo[]
  createdAt: string
}

export interface WatchChatMessage {
  id?: number
  roomCode: string
  senderId: number
  senderName: string
  senderEmail?: string
  senderTag?: string
  content: string
  createdAt: string
}

export interface WatchControlSignal {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'SYNC' | 'JOIN' | 'LEAVE' | 'ROOM_ENDED' | 'HOST_TRANSFER' | 'CHAT_MESSAGE'
  roomCode: string
  position?: number
  isPlaying?: boolean
  playbackRate?: number
  serverTimestamp?: string
  senderId?: number
  senderName?: string
  senderTag?: string
  payload?: any
}

export interface AdminStats {
  totalUsers: number
  totalMessages: number
  totalFiles: number
  totalWatchRooms: number
  totalMeetings: number
  totalMediaUploads: number
  totalMusicRooms?: number
  totalMusicTracks?: number
  activeWatchRooms: number
  activeMeetings: number
  activeMusicRooms?: number
  freeMemoryMB: number
  totalMemoryMB: number
  maxMemoryMB: number
  availableProcessors: number
  masterAdminEmail: string
}

export interface AdminRoomItem {
  type: 'WATCH' | 'MEET' | 'MUSIC'
  roomCode: string
  title: string
  hostName: string
  hostEmail: string
  status: string
  memberCount: number
  createdAt: string
}

export interface AdminFileItem {
  id: number
  filename: string
  fileSize: number
  mimeType: string
  storageType: string
  createdAt: string
  ownerName: string
  ownerEmail: string
}

// ===== MUSIC JAM TYPES =====

export interface MusicTrack {
  id: number
  title: string
  artist: string
  album?: string
  originalFilename: string
  storageKey: string
  mimeType: string
  fileSize: number
  duration: number
  coverArtUrl?: string
  streamUrl: string
  uploaderId: number
  uploaderName: string
  createdAt: string
}

export interface MusicRoomMember {
  id: number
  userId: number
  userName: string
  userTag?: string
  email: string
  role: 'HOST' | 'DJ' | 'LISTENER'
  joinedAt: string
}

export interface MusicQueueItem {
  id: number
  track: MusicTrack
  addedById: number
  addedByName: string
  orderIndex: number
  addedAt: string
}

export interface MusicRoom {
  id: number
  roomCode: string
  title: string
  hostId: number
  hostName: string
  hostEmail: string
  currentTrack?: MusicTrack | null
  currentPosition: number
  isPlaying: boolean
  playbackRate: number
  isCollaborative: boolean
  status: string
  lastSyncedAt: string
  members: MusicRoomMember[]
  queue: MusicQueueItem[]
  createdAt: string
}

export interface MusicSyncAction {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'SYNC' | 'NEXT' | 'PREV' | 'QUEUE_CHANGE' | 'REACTION' | 'CHAT' | 'TRACK_CHANGE'
  roomCode: string
  trackId?: number
  position?: number
  playbackRate?: number
  timestamp?: number
  emoji?: string
  chatContent?: string
  senderId?: number
  senderName?: string
}

export interface MusicChatMessage {
  id?: number
  roomCode: string
  senderId: number
  senderName: string
  senderTag?: string
  content: string
  createdAt: string
}

