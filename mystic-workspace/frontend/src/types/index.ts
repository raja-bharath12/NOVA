export interface User {
  id: number
  name: string
  email: string
  userTag?: string
  status?: 'ONLINE' | 'AWAY' | 'OFFLINE'
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
  type: 'CALL_REQUEST' | 'CALL_ACCEPT' | 'CALL_REJECT' | 'CALL_BUSY' | 'CALL_END' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE'
  senderId: number
  senderName: string
  targetUserId: number
  isVideo: boolean
  sdp?: any
  candidate?: any
  callId?: string
}

export interface MeetingSignal {
  type: 'JOIN' | 'LEAVE' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'SCREEN_SHARE_START' | 'SCREEN_SHARE_STOP' | 'HAND_RAISE' | 'CHAT_MESSAGE'
  roomCode: string
  senderId: number
  senderName: string
  targetUserId?: number
  sdp?: any
  candidate?: any
  isScreenSharing?: boolean
  isHandRaised?: boolean
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
  type: 'MESSAGE' | 'CALENDAR_EVENING' | 'CALENDAR_MORNING' | 'CALL' | 'TASK'
  title: string
  body: string
  targetUrl?: string
  senderName?: string
  createdAt: string
  read?: boolean
  eventId?: number
  conversationId?: number
}

