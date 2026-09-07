import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Pencil,
  Eraser,
  Minus,
  Square,
  Circle,
  MoveRight,
  Type,
  RotateCcw,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Download,
  Save,
  Hand,
  Sparkles,
  Users,
  Lock,
  Unlock,
  Check,
  X,
  ShieldCheck,
  UserCheck,
  UserX,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WhiteboardCursor, WhiteboardOp, WhiteboardPoint, WhiteboardTool, MeetingParticipant } from '../../types'
import whiteboardService from '../../services/whiteboardService'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface PendingAccessRequest {
  userId: number
  userName: string
  timestamp: string
}

interface MeetingWhiteboardProps {
  roomCode: string
  isHost: boolean
  meetingTitle?: string
  participants?: MeetingParticipant[]
  allowedUserIds: number[]
  allowAllParticipants: boolean
  onGrantAccess: (userId: number) => void
  onRevokeAccess: (userId: number) => void
  onToggleAllowAll: (allowed: boolean) => void
  onRequestAccess: () => void
  onCloseWhiteboard?: () => void
  pendingRequests: PendingAccessRequest[]
  onApproveRequest: (userId: number) => void
  onDenyRequest: (userId: number) => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

const PALETTE = [
  '#ffffff',
  '#a855f7',
  '#38bdf8',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#f472b6',
  '#818cf8',
]

const STROKE_WIDTHS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 5 },
  { label: 'L', value: 10 },
  { label: 'XL', value: 18 },
]

export const MeetingWhiteboard: React.FC<MeetingWhiteboardProps> = ({
  roomCode,
  isHost,
  meetingTitle = 'Meeting Whiteboard',
  participants = [],
  allowedUserIds,
  allowAllParticipants,
  onGrantAccess,
  onRevokeAccess,
  onToggleAllowAll,
  onRequestAccess,
  onCloseWhiteboard,
  pendingRequests,
  onApproveRequest,
  onDenyRequest,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const { user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Determine drawing permission for current user
  const canDraw = isHost || allowAllParticipants || (user?.id ? allowedUserIds.includes(user.id) : false)

  // Tools & Styling
  const [tool, setTool] = useState<WhiteboardTool>('PEN')
  const [color, setColor] = useState<string>('#a855f7')
  const [strokeWidth, setStrokeWidth] = useState<number>(3)
  const [isPanMode, setIsPanMode] = useState<boolean>(false)

  // Canvas Transform State
  const [zoom, setZoom] = useState<number>(1)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const isDraggingPan = useRef<boolean>(false)
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Operations and History Stack
  const [ops, setOps] = useState<WhiteboardOp[]>([])
  const [redoStack, setRedoStack] = useState<WhiteboardOp[]>([])
  const currentPath = useRef<WhiteboardPoint[]>([])
  const isDrawing = useRef<boolean>(false)
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Remote Cursors
  const [remoteCursors, setRemoteCursors] = useState<Map<number, WhiteboardCursor>>(new Map())
  const lastCursorBroadcast = useRef<number>(0)

  // Request Sent State
  const [requestSent, setRequestSent] = useState<boolean>(false)
  const [showPermissionsMenu, setShowPermissionsMenu] = useState<boolean>(false)
  const [savedStatus, setSavedStatus] = useState<string>('')

  // Inline Text Input Tool
  const [textInput, setTextInput] = useState<{
    visible: boolean
    x: number
    y: number
    canvasX: number
    canvasY: number
    value: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0,
    canvasY: 0,
    value: '',
  })

  // Load meeting whiteboard data on mount
  useEffect(() => {
    async function fetchMeetingWhiteboard() {
      try {
        const res = await api.get<{ dataJson?: string }>(`/whiteboards/meeting/${roomCode}`)
        if (res.data && res.data.dataJson) {
          const parsed = JSON.parse(res.data.dataJson)
          if (Array.isArray(parsed)) {
            setOps(parsed)
          }
        }
      } catch (err) {
        console.warn('Could not load existing whiteboard for meeting room:', err)
      }
    }
    if (roomCode) {
      fetchMeetingWhiteboard()
    }
  }, [roomCode])

  // Reset requestSent if access is granted
  useEffect(() => {
    if (canDraw && requestSent) {
      setRequestSent(false)
    }
  }, [canDraw, requestSent])

  // STOMP Sync Subscription for live drawing and cursor movements
  useEffect(() => {
    if (!roomCode) return

    const handleRemoteOp = (op: WhiteboardOp) => {
      if (op.userId && op.userId === user?.id) return // skip own echo
      if (op.tool === 'CLEAR') {
        setOps([])
      } else {
        setOps((prev) => [...prev, op])
      }
    }

    const handleRemoteCursor = (cursor: WhiteboardCursor) => {
      if (cursor.userId === user?.id) return
      setRemoteCursors((prev) => {
        const next = new Map(prev)
        next.set(cursor.userId, cursor)
        return next
      })
    }

    const unsubscribe = whiteboardService.subscribeToMeetingWhiteboard(
      roomCode,
      handleRemoteOp,
      handleRemoteCursor
    )

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [roomCode, user?.id])

  // Clean stale remote cursors every 10s
  useEffect(() => {
    const timer = setInterval(() => {
      setRemoteCursors(new Map())
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // Drawing Helper Functions
  const drawOp = (ctx: CanvasRenderingContext2D, op: WhiteboardOp) => {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = op.strokeWidth || 3
    ctx.strokeStyle = op.color || '#a855f7'
    ctx.fillStyle = op.color || '#a855f7'

    if (op.tool === 'ERASER') {
      ctx.strokeStyle = '#07060f'
      ctx.lineWidth = (op.strokeWidth || 10) * 3
    }

    if ((op.tool === 'PEN' || op.tool === 'ERASER') && op.points && op.points.length > 0) {
      ctx.beginPath()
      ctx.moveTo(op.points[0].x, op.points[0].y)
      for (let i = 1; i < op.points.length; i++) {
        ctx.lineTo(op.points[i].x, op.points[i].y)
      }
      ctx.stroke()
    } else if (op.tool === 'LINE' && op.x !== undefined && op.y !== undefined && op.endX !== undefined && op.endY !== undefined) {
      ctx.beginPath()
      ctx.moveTo(op.x, op.y)
      ctx.lineTo(op.endX, op.endY)
      ctx.stroke()
    } else if (op.tool === 'RECTANGLE' && op.x !== undefined && op.y !== undefined && op.endX !== undefined && op.endY !== undefined) {
      const w = op.endX - op.x
      const h = op.endY - op.y
      ctx.strokeRect(op.x, op.y, w, h)
    } else if (op.tool === 'CIRCLE' && op.x !== undefined && op.y !== undefined && op.endX !== undefined && op.endY !== undefined) {
      const radiusX = Math.abs(op.endX - op.x) / 2
      const radiusY = Math.abs(op.endY - op.y) / 2
      const centerX = Math.min(op.x, op.endX) + radiusX
      const centerY = Math.min(op.y, op.endY) + radiusY
      ctx.beginPath()
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (op.tool === 'ARROW' && op.x !== undefined && op.y !== undefined && op.endX !== undefined && op.endY !== undefined) {
      const headlen = 15
      const angle = Math.atan2(op.endY - op.y, op.endX - op.x)
      ctx.beginPath()
      ctx.moveTo(op.x, op.y)
      ctx.lineTo(op.endX, op.endY)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(op.endX, op.endY)
      ctx.lineTo(
        op.endX - headlen * Math.cos(angle - Math.PI / 6),
        op.endY - headlen * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        op.endX - headlen * Math.cos(angle + Math.PI / 6),
        op.endY - headlen * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()
    } else if (op.tool === 'TEXT' && op.x !== undefined && op.y !== undefined && op.text) {
      ctx.font = `600 ${op.fontSize || 18}px 'Space Grotesk', sans-serif`
      ctx.fillText(op.text, op.x, op.y)
    }

    ctx.restore()
  }

  // Render Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear viewport
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background Grid
    ctx.fillStyle = '#07060f'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Subtle Dot Matrix
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
    const gridSize = 24 * zoom
    const startX = (panOffset.x * zoom) % gridSize
    const startY = (panOffset.y * zoom) % gridSize

    for (let x = startX; x < canvas.width; x += gridSize) {
      for (let y = startY; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.arc(x, y, 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Apply Zoom & Pan Transform
    ctx.translate(panOffset.x * zoom, panOffset.y * zoom)
    ctx.scale(zoom, zoom)

    // Draw all completed operations
    for (const op of ops) {
      drawOp(ctx, op)
    }

    ctx.restore()
  }, [ops, panOffset, zoom])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  // Handle Window & Container Resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      canvasRef.current.width = rect.width
      canvasRef.current.height = rect.height
      redrawCanvas()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [redrawCanvas])

  // Coordinate Conversion
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, rawX: 0, rawY: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top
    const canvasX = clientX / zoom - panOffset.x
    const canvasY = clientY / zoom - panOffset.y
    return { x: canvasX, y: canvasY, rawX: clientX, rawY: clientY }
  }

  // Broadcast Cursor (throttled)
  const broadcastCursor = (x: number, y: number, isDrawingNow: boolean) => {
    if (!canDraw) return
    const now = Date.now()
    if (now - lastCursorBroadcast.current < 45) return
    lastCursorBroadcast.current = now

    const cursorData: WhiteboardCursor = {
      userId: user?.id || 0,
      userName: user?.name || 'User',
      color,
      x,
      y,
      isDrawing: isDrawingNow,
    }

    whiteboardService.sendMeetingCursor(roomCode, cursorData)
  }

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw) return

    // Pan mode or middle click
    if (isPanMode || e.button === 1) {
      isDraggingPan.current = true
      panStart.current = { x: e.clientX - panOffset.x * zoom, y: e.clientY - panOffset.y * zoom }
      return
    }

    const { x, y, rawX, rawY } = getCanvasCoords(e)

    if (tool === 'TEXT') {
      setTextInput({
        visible: true,
        x: rawX,
        y: rawY,
        canvasX: x,
        canvasY: y,
        value: '',
      })
      return
    }

    isDrawing.current = true
    startPos.current = { x, y }

    if (tool === 'PEN' || tool === 'ERASER') {
      currentPath.current = [{ x, y }]
    }

    broadcastCursor(x, y, true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingPan.current) {
      const newX = (e.clientX - panStart.current.x) / zoom
      const newY = (e.clientY - panStart.current.y) / zoom
      setPanOffset({ x: newX, y: newY })
      return
    }

    const { x, y } = getCanvasCoords(e)
    if (canDraw) {
      broadcastCursor(x, y, isDrawing.current)
    }

    if (!isDrawing.current || !canDraw) return

    if (tool === 'PEN' || tool === 'ERASER') {
      currentPath.current.push({ x, y })

      // Live draw preview
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.translate(panOffset.x * zoom, panOffset.y * zoom)
          ctx.scale(zoom, zoom)
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.lineWidth = strokeWidth
          ctx.strokeStyle = tool === 'ERASER' ? '#07060f' : color
          if (tool === 'ERASER') ctx.lineWidth = strokeWidth * 3

          const pts = currentPath.current
          if (pts.length > 1) {
            ctx.beginPath()
            ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
            ctx.stroke()
          }
          ctx.restore()
        }
      }
    } else {
      // Shape Preview
      redrawCanvas()
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.translate(panOffset.x * zoom, panOffset.y * zoom)
          ctx.scale(zoom, zoom)
          drawOp(ctx, {
            tool,
            color,
            strokeWidth,
            x: startPos.current.x,
            y: startPos.current.y,
            endX: x,
            endY: y,
          })
          ctx.restore()
        }
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingPan.current) {
      isDraggingPan.current = false
      return
    }

    if (!isDrawing.current || !canDraw) return
    isDrawing.current = false

    const { x, y } = getCanvasCoords(e)
    let newOp: WhiteboardOp | null = null

    if (tool === 'PEN' || tool === 'ERASER') {
      if (currentPath.current.length > 0) {
        newOp = {
          id: Math.random().toString(36).substring(2, 9),
          tool,
          color: tool === 'ERASER' ? '#07060f' : color,
          strokeWidth,
          points: [...currentPath.current],
          userId: user?.id,
          userName: user?.name,
          timestamp: new Date().toISOString(),
        }
      }
      currentPath.current = []
    } else if (['LINE', 'RECTANGLE', 'CIRCLE', 'ARROW'].includes(tool)) {
      newOp = {
        id: Math.random().toString(36).substring(2, 9),
        tool,
        color,
        strokeWidth,
        x: startPos.current.x,
        y: startPos.current.y,
        endX: x,
        endY: y,
        userId: user?.id,
        userName: user?.name,
        timestamp: new Date().toISOString(),
      }
    }

    if (newOp) {
      setOps((prev) => [...prev, newOp!])
      setRedoStack([])
      whiteboardService.sendMeetingOp(roomCode, newOp)
    }

    broadcastCursor(x, y, false)
  }

  // Handle Text Submission
  const handleTextSubmit = () => {
    if (!textInput.value.trim() || !canDraw) {
      setTextInput((prev) => ({ ...prev, visible: false }))
      return
    }

    const newOp: WhiteboardOp = {
      id: Math.random().toString(36).substring(2, 9),
      tool: 'TEXT',
      color,
      x: textInput.canvasX,
      y: textInput.canvasY,
      text: textInput.value.trim(),
      fontSize: strokeWidth * 5 + 14,
      userId: user?.id,
      userName: user?.name,
      timestamp: new Date().toISOString(),
    }

    setOps((prev) => [...prev, newOp])
    setRedoStack([])
    setTextInput((prev) => ({ ...prev, visible: false, value: '' }))
    whiteboardService.sendMeetingOp(roomCode, newOp)
  }

  // Undo / Redo / Clear
  const handleUndo = () => {
    if (ops.length === 0 || !canDraw) return
    const lastOp = ops[ops.length - 1]
    setOps((prev) => prev.slice(0, prev.length - 1))
    setRedoStack((prev) => [...prev, lastOp])
  }

  const handleRedo = () => {
    if (redoStack.length === 0 || !canDraw) return
    const opToRestore = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, prev.length - 1))
    setOps((prev) => [...prev, opToRestore])
    whiteboardService.sendMeetingOp(roomCode, opToRestore)
  }

  const handleClear = () => {
    if (!canDraw) return
    if (!window.confirm('Clear the meeting whiteboard canvas for everyone?')) return
    setOps([])
    setRedoStack([])

    const clearOp: WhiteboardOp = {
      tool: 'CLEAR',
      userId: user?.id,
      userName: user?.name,
      timestamp: new Date().toISOString(),
    }

    whiteboardService.sendMeetingOp(roomCode, clearOp)
  }

  // Zoom Controls
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.3, prev + delta), 3))
  }

  const handleResetView = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  // Export PNG
  const handleExportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${roomCode}_whiteboard.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // Save to Backend
  const handleSaveToBackend = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const dataString = JSON.stringify(ops)
      await api.post('/whiteboards', {
        title: meetingTitle || `Meeting ${roomCode} Whiteboard`,
        meetingRoomCode: roomCode,
        dataJson: dataString,
      })
      setSavedStatus('Saved!')
      setTimeout(() => setSavedStatus(''), 2500)
    } catch (err) {
      console.error('Failed to save whiteboard to backend:', err)
      setSavedStatus('Save Failed')
      setTimeout(() => setSavedStatus(''), 2500)
    }
  }

  const handleSendRequest = () => {
    setRequestSent(true)
    onRequestAccess()
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] overflow-hidden select-none bg-[#07060f] rounded-2xl border border-white/10 shadow-2xl flex flex-col"
    >
      {/* ===== HOST ACCESS REQUEST BANNER (Pop-up on Host screen) ===== */}
      <AnimatePresence>
        {isHost && pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg bg-gradient-to-r from-violet-900/95 via-indigo-900/95 to-purple-900/95 backdrop-blur-xl border border-violet-400/40 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(139,92,246,0.35)] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-violet-500/30 border border-violet-400/40 flex items-center justify-center text-violet-300 flex-shrink-0 animate-pulse">
                <Pencil size={15} />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">
                  <span className="text-cyan-300">{pendingRequests[0].userName}</span> requested Draw Access
                </p>
                <p className="text-[10px] text-white/60">
                  Allow participant to draw and collaborate on this whiteboard
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onApproveRequest(pendingRequests[0].userId)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-void-950 font-bold text-xs flex items-center gap-1 shadow-md transition-all active:scale-95"
              >
                <Check size={13} />
                <span>Allow</span>
              </button>
              <button
                onClick={() => onDenyRequest(pendingRequests[0].userId)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 transition-colors"
                title="Deny"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TOP FLOATING HEADER BAR ===== */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2">
        {/* Title & Status Badge */}
        <div className="pointer-events-auto flex items-center gap-2.5 bg-[#0f0c20]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-lg">
          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse flex-shrink-0" />
          <span className="text-xs font-semibold text-silver tracking-wide truncate max-w-[140px] sm:max-w-xs">
            {meetingTitle}
          </span>

          {/* Access Status Pill */}
          {isHost ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
              <ShieldCheck size={11} />
              <span>Host</span>
            </span>
          ) : canDraw ? (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Unlock size={10} />
              <span>Draw Allowed</span>
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Lock size={10} />
              <span>View Only</span>
            </span>
          )}

          {remoteCursors.size > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 ml-1 pl-2 border-l border-white/10">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-cyan-300 font-mono">
                {remoteCursors.size + 1} live
              </span>
            </div>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#0f0c20]/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 shadow-lg">
          {/* Zoom Controls */}
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded text-white/70 hover:bg-white/10"
            title="Reset View"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-white/10 mx-0.5" />

          {/* Host Permissions Manager Button */}
          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowPermissionsMenu(!showPermissionsMenu)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                  showPermissionsMenu || pendingRequests.length > 0
                    ? 'bg-violet-600 text-white shadow-glow'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Manage Participant Drawing Permissions"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Access</span>
                {pendingRequests.length > 0 && (
                  <span className="h-4 w-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-bounce">
                    {pendingRequests.length}
                  </span>
                )}
              </button>

              {/* Host Permissions Dropdown / Modal */}
              <AnimatePresence>
                {showPermissionsMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    className="absolute right-0 top-9 z-50 w-72 bg-[#120f26] border border-violet-500/30 rounded-2xl p-4 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-violet-400" />
                        <span>Whiteboard Access Control</span>
                      </h4>
                      <button
                        onClick={() => setShowPermissionsMenu(false)}
                        className="text-white/40 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Allow All Toggle */}
                    <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5 mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">Allow Everyone to Draw</p>
                        <p className="text-[10px] text-white/50">All participants can draw simultaneously</p>
                      </div>
                      <button
                        onClick={() => onToggleAllowAll(!allowAllParticipants)}
                        className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                          allowAllParticipants ? 'bg-emerald-500' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white transition-transform ${
                            allowAllParticipants ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Participant List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Participants ({participants.length})
                      </p>
                      {participants.length === 0 ? (
                        <p className="text-xs text-white/40 italic py-2">No other participants yet</p>
                      ) : (
                        participants.map((p) => {
                          const isUserHost = p.role === 'HOST' || p.user.id === user?.id
                          const isAllowed = allowAllParticipants || allowedUserIds.includes(p.user.id)
                          const isPending = pendingRequests.some((r) => r.userId === p.user.id)

                          return (
                            <div
                              key={p.user.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5"
                            >
                              <div className="truncate min-w-0 pr-2">
                                <p className="text-xs font-medium text-white truncate">{p.user.name}</p>
                                <span className="text-[10px] text-white/40">
                                  {isUserHost
                                    ? 'Host'
                                    : isAllowed
                                    ? 'Draw Allowed'
                                    : isPending
                                    ? 'Access Requested'
                                    : 'View Only'}
                                </span>
                              </div>

                              {!isUserHost && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isAllowed ? (
                                    <button
                                      onClick={() => onRevokeAccess(p.user.id)}
                                      className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-medium flex items-center gap-1 border border-rose-500/30 transition-colors"
                                    >
                                      <UserX size={11} />
                                      <span>Revoke</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onGrantAccess(p.user.id)}
                                      className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-medium flex items-center gap-1 border border-emerald-500/30 transition-colors"
                                    >
                                      <UserCheck size={11} />
                                      <span>Allow</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Export PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Save Canvas */}
          <button
            onClick={handleSaveToBackend}
            className="flex items-center gap-1 text-[11px] font-semibold bg-violet-600/60 hover:bg-violet-600 text-white px-2 py-1 rounded-lg shadow-sm transition-all"
            title="Save to Meeting Cloud"
          >
            <Save className="w-3 h-3" />
            <span>{savedStatus || 'Save'}</span>
          </button>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title={isFullscreen ? 'Minimize' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onCloseWhiteboard && isHost && (
            <button
              onClick={onCloseWhiteboard}
              className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Close Whiteboard for Meeting"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ===== DRAWING TOOLBAR (Left-aligned, visible only when canDraw is true) ===== */}
      {canDraw && (
        <div className="absolute left-3 top-16 z-20 flex flex-col gap-1.5 bg-[#0f0c20]/95 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          {/* Main Drawing Tools */}
          <div className="grid grid-cols-1 gap-1">
            <button
              onClick={() => {
                setTool('PEN')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'PEN' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Pen Tool"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setTool('ERASER')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'ERASER' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Eraser Tool"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setTool('LINE')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'LINE' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Line Tool"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setTool('RECTANGLE')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'RECTANGLE' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Rectangle Tool"
            >
              <Square className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setTool('CIRCLE')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'CIRCLE' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Circle Tool"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setTool('ARROW')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'ARROW' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Arrow Tool"
            >
              <MoveRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setTool('TEXT')
                setIsPanMode(false)
              }}
              className={`p-2 rounded-xl transition-all ${
                tool === 'TEXT' && !isPanMode
                  ? 'bg-violet-600 text-white shadow-glow scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Text Tool"
            >
              <Type className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsPanMode(!isPanMode)}
              className={`p-2 rounded-xl transition-all ${
                isPanMode
                  ? 'bg-cyan-500 text-void-950 font-bold shadow-glow-cyan scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Pan Canvas"
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full h-px bg-white/10 my-0.5" />

          {/* Color Swatches */}
          <div className="grid grid-cols-2 gap-1 p-0.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
                title={`Color: ${c}`}
              />
            ))}
          </div>

          <div className="w-full h-px bg-white/10 my-0.5" />

          {/* Stroke Width Selector */}
          <div className="flex flex-col gap-0.5">
            {STROKE_WIDTHS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStrokeWidth(s.value)}
                className={`text-[9px] font-mono py-0.5 rounded transition-colors ${
                  strokeWidth === s.value
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="w-full h-px bg-white/10 my-0.5" />

          {/* Undo / Redo / Clear Actions */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={handleUndo}
              disabled={ops.length === 0}
              className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Undo"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Redo"
            >
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Clear Canvas"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ===== PARTICIPANT VIEW-ONLY FLOATING PROMPT (When participant does not have draw access) ===== */}
      {!canDraw && !isHost && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-3.5 border border-amber-500/30 bg-[#120f26]/90 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 flex-shrink-0">
                <Lock size={15} />
              </div>
              <div>
                <p className="text-xs font-semibold text-silver">View-Only Mode</p>
                <p className="text-[10px] text-muted">You are watching the live meeting whiteboard</p>
              </div>
            </div>

            <button
              onClick={handleSendRequest}
              disabled={requestSent}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs flex items-center gap-1.5 shadow-glow hover:opacity-90 disabled:opacity-60 transition-all flex-shrink-0"
            >
              <Pencil size={12} />
              <span>{requestSent ? 'Requested...' : 'Request Draw Access'}</span>
            </button>
          </motion.div>
        </div>
      )}

      {/* Main Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full flex-1 ${
          canDraw ? (isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair') : 'cursor-default'
        }`}
      />

      {/* Inline Text Input overlay */}
      {textInput.visible && (
        <div
          className="absolute z-30 flex items-center gap-2 bg-[#16142a] p-2 rounded-xl border border-violet-500/50 shadow-2xl"
          style={{
            left: `${Math.min(textInput.x, (canvasRef.current?.width || 500) - 240)}px`,
            top: `${Math.min(textInput.y, (canvasRef.current?.height || 500) - 50)}px`,
          }}
        >
          <input
            type="text"
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput((prev) => ({ ...prev, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSubmit()
              if (e.key === 'Escape') setTextInput((prev) => ({ ...prev, visible: false }))
            }}
            placeholder="Type text..."
            className="bg-transparent border-none text-white text-xs outline-none px-1.5 py-0.5 w-36 font-medium"
            style={{ color }}
          />
          <button
            onClick={handleTextSubmit}
            className="px-2 py-0.5 bg-violet-600 hover:bg-violet-500 text-[11px] text-white rounded-lg font-semibold"
          >
            Add
          </button>
        </div>
      )}

      {/* Remote Cursor Badges */}
      {Array.from(remoteCursors.values()).map((rc) => {
        const screenX = (rc.x + panOffset.x) * zoom
        const screenY = (rc.y + panOffset.y) * zoom

        return (
          <div
            key={rc.userId}
            className="absolute pointer-events-none transition-all duration-75 z-30"
            style={{
              left: `${screenX}px`,
              top: `${screenY}px`,
            }}
          >
            <div className="relative">
              {/* Glowing Pointer Dot */}
              <div
                className="w-3 h-3 rounded-full ring-2 ring-white shadow-lg animate-pulse"
                style={{ backgroundColor: rc.color || '#a855f7' }}
              />
              {/* Badge Tag */}
              <div
                className="absolute left-3.5 top-0 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap shadow-md"
                style={{ backgroundColor: rc.color || '#a855f7' }}
              >
                {rc.userName} ✦
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MeetingWhiteboard
