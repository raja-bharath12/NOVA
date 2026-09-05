# NOVA — Intelligent Productivity & Collaboration Workspace

NOVA is a futuristic, full-stack collaborative workspace engineered with Spring Boot 3 (Java 17/21) on the backend and React 18, TypeScript, TailwindCSS, and Framer Motion on the frontend.

---

## Capabilities Overview

### Stage 1: Core Foundation & Productivity
- **Stateless JWT Security**: BCrypt password encryption, HMAC-SHA256 tokens, custom authentication filter chain.
- **Task Management**: Real-time task creation, categorized priority tags (High, Medium, Low), deadline tracking, completion toggles.
- **Interactive Calendar**: Event scheduling, meeting links, location attributes.
- **Dynamic Dashboard**: Live counts with animated numerical counters and dynamic time greetings.
- **Futuristic UI**: "Mystic Void" dark theme (`#07060B`), glassmorphism panels, subtle aurora background animations, luminous borders, and Space Grotesk typography.

### Stage 2: Real-Time Chat & Collaboration
- **1-to-1 and Group Chats**: Instant peer-to-peer and team conversations.
- **STOMP over WebSocket**: Secure channel communication (`/topic/conversations.{id}`, `/topic/presence`, `/user/queue/notifications`).
- **Typing Indicators**: Real-time debounced typing notifications with animated pulse dots.
- **Online Presence**: Dynamic `ONLINE` / `AWAY` / `OFFLINE` status tracking and broadcasting.
- **Read Receipts**: Persistent message delivery and read confirmations (`✓ Sent`, `✓✓ Delivered`, `✓✓ Read`).
- **Message Operations**: Replying to messages, editing, and deleting with real-time sync across connected clients.

### Stage 3: File Sharing, Calling & Meeting Rooms
- **Pluggable Object Storage**: Dual storage strategy supporting **AWS S3** and **Local Filesystem** storage with automatic directory isolation and path-traversal protection.
- **Rich Chat Attachments**: Upload and preview Images (lightbox), Videos (inline player), PDFs, and Documents directly inside messages.
- **File Workspace**: Drag-and-drop file uploader with animated percentage progress (`Uploading 45%` → `Uploading 80%` → `Upload complete`), category filters (Recent, My Files, Shared, Images, Documents, Videos), and instant downloads.
- **WebRTC 1-to-1 Audio & Video Calls**: Ultra-low latency voice and video calls with incoming call alerts (`[Accept]` / `[Reject]`), microphone/camera toggling, audio visualizers, and connection duration timers.
- **WebRTC Multi-Party Meeting Rooms**: Instant room generation (`nova-abc-xyz`), mesh signaling, responsive video grids, active speaker indicators, screen sharing (`getDisplayMedia`), in-meeting live chat, and hand-raising.

### Stage 4: Real-Time Whiteboard, AI Productivity Assistant & Global Spotlight Search
- **Real-Time Collaborative Whiteboard**:
  - HTML5 Vector Canvas engine supporting **Pen, Eraser, Line, Rectangle, Circle, Arrow, Text, Undo, Redo, Clear, Zoom, and Pan**.
  - **Delta-Based STOMP Sync**: Compact operation streaming (`WhiteboardOpDto`) across participants without large image payloads.
  - **Live Remote Cursor Presence**: Colored avatar badges (`Raja ✦`, `Arun ✦`) with throttled broadcasting (50ms) for high-performance multi-user tracking.
  - **Export & Storage**: Export high-resolution PNG snapshots and persist canvas state to PostgreSQL.
  - **In-Meeting Collaboration**: Switch to live whiteboard mode directly inside active video meeting rooms.
- **NOVA AI Productivity Assistant**:
  - Context-aware productivity intelligence pulling real-time workspace tasks, meetings, deadlines, and files.
  - **Daily Schedule Planning**: Automatically schedules focus blocks and organizes pending tasks around scheduled conferences.
  - **Subtask Generation & One-Click Creation**: Breaks complex milestones into actionable subtasks with 1-click addition to personal task boards (`POST /api/ai/create-tasks`).
  - **Automated Meeting Summaries**: Generates structured recaps, key decisions, and prioritized action items.
  - **Productivity Telemetry**: Live completion rates, weekly velocity metrics, and AI recommendations.
- **Spotlight Global Search (`Ctrl+K` / `Cmd+K`)**:
  - Cross-module instant search across **Tasks, Events, Messages, Files, Meetings, and Whiteboards**.
  - Filter pills, keyboard navigation (Up/Down/Enter/Escape), and fast routing.
- **Unified Command Center**:
  - Re-imagined Dashboard unifying active meeting rooms, whiteboards, priority tasks, and AI summary feeds.

---

## Project Structure

```
mystic-workspace/
├── backend/
│   ├── src/main/java/com/mystic/workspace/
│   │   ├── config/          # SecurityConfig, WebSocketConfig (STOMP JWT Interceptor)
│   │   ├── controller/      # Auth, Task, Event, File, Conversation, Message, Meeting, Whiteboard, AiAssistant, Search
│   │   ├── dto/             # Typed API & WebSocket Transfer Objects
│   │   ├── entity/          # User, Task, Event, FileMetadata, Conversation, Message, Meeting, Whiteboard
│   │   ├── repository/      # Spring Data JPA Repositories
│   │   ├── security/        # JwtAuthFilter, JwtService, UserPrincipal
│   │   ├── service/         # Business logic, Presence, Whiteboard, AI, and Search
│   │   │   └── storage/     # StorageService, LocalStorageService, S3StorageService
│   │   └── websocket/       # Chat, Signaling, Whiteboard & Event Listeners
│   └── src/test/java/       # Comprehensive JUnit test suite (16 tests passing)
└── frontend/
    └── src/
        ├── components/      # GlassPanel, AnimatedBackground, CallModal, TopBar, WhiteboardCanvas, AiAssistantDrawer, GlobalSearchModal
        ├── context/         # AuthContext, CallContext, ToastContext
        ├── pages/           # Dashboard, Tasks, Calendar, Chat, Files, Meetings, MeetingRoom, Whiteboard
        ├── services/        # websocketService, webrtcService, chatService, fileService, meetingService, whiteboardService, aiService, searchService
        └── types/           # Complete TypeScript domain interfaces
```

---

## Getting Started

### Prerequisites
- **Java**: JDK 17 or 21
- **Node.js**: v18+ (Node 20 or 24 recommended)
- **Maven**: 3.9+
- **PostgreSQL**: Running locally on port 5432 (or configured via environment)

---

### 1. Database Setup

Create the PostgreSQL database:
```sql
CREATE DATABASE mystic_workspace;
```

---

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Verify configuration in `src/main/resources/application.properties`:
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/mystic_workspace
   spring.datasource.username=postgres
   spring.datasource.password=postgres
   app.storage.type=local
   app.storage.local-dir=./uploads
   ```
3. Run backend automated tests:
   ```bash
   mvn test
   ```
4. Start the Spring Boot application:
   ```bash
   mvn spring-boot:run
   ```
   The backend API will start on **`http://localhost:8080`**.

---

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open **`http://localhost:5173`** in your browser.

---

## API & WebSocket Endpoints Overview

### REST Endpoints

| Category | Method | Path | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/auth/register` | Create user account, returns JWT |
| **Auth** | `POST` | `/api/auth/login` | Login, returns JWT |
| **Tasks** | `GET / POST` | `/api/tasks` | List or create tasks |
| **Tasks** | `PUT / PATCH / DELETE` | `/api/tasks/{id}` | Update, toggle complete, or delete |
| **Calendar** | `GET / POST / DELETE` | `/api/events` | Manage calendar items |
| **Conversations** | `GET / POST` | `/api/conversations` | List user chats or create new 1:1 / group chat |
| **Conversations** | `POST / DELETE` | `/api/conversations/{id}/members` | Add or remove conversation members |
| **Messages** | `GET / POST` | `/api/conversations/{id}/messages` | Message history or send message |
| **Messages** | `PUT / DELETE` | `/api/messages/{id}` | Edit or delete message |
| **Files** | `POST` | `/api/files/upload` | Multipart file upload (images, docs, video, audio) |
| **Files** | `GET` | `/api/files` | Query files by category or keyword |
| **Files** | `GET` | `/api/files/{id}/download` | Stream download or S3 presigned URL redirect |
| **Meetings** | `POST` | `/api/meetings/instant` | Generate instant meeting room (`nova-xxx-yyy`) |
| **Meetings** | `POST` | `/api/meetings/schedule` | Schedule upcoming team conference |
| **Meetings** | `GET` | `/api/meetings/{roomCode}` | Get meeting room details |
| **Whiteboards** | `GET / POST` | `/api/whiteboards` | List user whiteboards or create canvas |
| **Whiteboards** | `GET / PUT / DELETE` | `/api/whiteboards/{id}` | Retrieve, save vector ops/snapshot, or delete |
| **Whiteboards** | `GET` | `/api/whiteboards/meeting/{roomCode}` | Get or bind whiteboard for meeting room |
| **AI Assistant** | `POST` | `/api/ai/chat` | Contextual AI chat & schedule planning |
| **AI Assistant** | `POST` | `/api/ai/create-tasks` | One-click bulk task generation |
| **AI Assistant** | `GET` | `/api/ai/analytics` | Productivity metrics & executive summary |
| **Global Search** | `GET` | `/api/search?q={query}` | Search tasks, events, messages, files, meetings, whiteboards |

### WebSocket & STOMP Channels

| Destination | Purpose |
|---|---|
| `/ws` | STOMP connection endpoint (SockJS & native WebSocket) |
| `/topic/conversations.{id}` | Real-time message broadcast, edits, and deletions |
| `/topic/conversations.{id}.typing` | Real-time typing indicators |
| `/topic/conversations.{id}.reads` | Message read receipts |
| `/topic/presence` | User online / away / offline presence updates |
| `/user/queue/call.signal` | 1-to-1 WebRTC audio/video call signaling |
| `/topic/meeting.{roomCode}.signal` | Multi-party WebRTC meeting mesh signaling |
| `/topic/meeting.{roomCode}.chat` | In-meeting real-time chat messages |
| `/user/queue/notifications` | Direct user notifications and alerts |
| `/topic/whiteboard.{boardId}.ops` | Real-time standalone whiteboard vector delta ops |
| `/topic/whiteboard.{boardId}.cursors` | Standalone whiteboard participant cursor broadcasts |
| `/topic/meeting.{roomCode}.whiteboard.ops` | In-meeting collaborative whiteboard delta operations |
| `/topic/meeting.{roomCode}.whiteboard.cursors` | In-meeting participant cursor presence |
