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
  Maximize2,
  Download,
  Save,
  Hand,
  Sparkles,
  Users,
} from 'lucide-react'
import type { WhiteboardCursor, WhiteboardOp, WhiteboardPoint, WhiteboardTool } from '../../types'
import whiteboardService from '../../services/whiteboardService'
import { useAuth } from '../../context/AuthContext'

interface WhiteboardCanvasProps {
  boardId?: number
  meetingRoomCode?: string
  initialData?: string
  title?: string
  onSave?: (canvasData: string, snapshotUrl: string) => void
  readOnly?: boolean
}

const PALETTE = [
  '#ffffff',
  '#a855f7',
  '#3b82f6',
  '#06d6a0',
  '#fbbf24',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
]

const STROKE_WIDTHS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 5 },
  { label: 'L', value: 10 },
  { label: 'XL', value: 20 },
]

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  boardId,
  meetingRoomCode,
  initialData,
  title = 'Nova Canvas',
  onSave,
  readOnly = false,
}) => {
  const { user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  // Load initial data
  useEffect(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData)
        if (Array.isArray(parsed)) {
          setOps(parsed)
        }
      } catch (err) {
        console.warn('Could not parse initial canvasData', err)
      }
    }
  }, [initialData])

  // STOMP Sync Subscription
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

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

    if (boardId) {
      unsubscribe = whiteboardService.subscribeToWhiteboard(
        boardId,
        handleRemoteOp,
        handleRemoteCursor
      )
    } else if (meetingRoomCode) {
      unsubscribe = whiteboardService.subscribeToMeetingWhiteboard(
        meetingRoomCode,
        handleRemoteOp,
        handleRemoteCursor
      )
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [boardId, meetingRoomCode, user?.id])

  // Clean stale remote cursors every 10s
  useEffect(() => {
    const timer = setInterval(() => {
      setRemoteCursors(new Map())
    }, 12000)
    return () => clearInterval(timer)
  }, [])

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
    ctx.fillStyle = '#0a0914'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Subtle Dot Matrix
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
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

  // Handle Window Resize
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

  // Drawing Helper Functions
  const drawOp = (ctx: CanvasRenderingContext2D, op: WhiteboardOp) => {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = op.strokeWidth || 3
    ctx.strokeStyle = op.color || '#a855f7'
    ctx.fillStyle = op.color || '#a855f7'

    if (op.tool === 'ERASER') {
      ctx.strokeStyle = '#0a0914'
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
    const now = Date.now()
    if (now - lastCursorBroadcast.current < 50) return
    lastCursorBroadcast.current = now

    const cursorData: WhiteboardCursor = {
      userId: user?.id || 0,
      userName: user?.name || 'Anonymous',
      color,
      x,
      y,
      isDrawing: isDrawingNow,
    }

    if (boardId) {
      whiteboardService.sendCursor(boardId, cursorData)
    } else if (meetingRoomCode) {
      whiteboardService.sendMeetingCursor(meetingRoomCode, cursorData)
    }
  }

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return

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
    broadcastCursor(x, y, isDrawing.current)

    if (!isDrawing.current || readOnly) return

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
          ctx.strokeStyle = tool === 'ERASER' ? '#0a0914' : color
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
      // Shape Preview: redraw all then draw current shape
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

    if (!isDrawing.current || readOnly) return
    isDrawing.current = false

    const { x, y } = getCanvasCoords(e)

    let newOp: WhiteboardOp | null = null

    if (tool === 'PEN' || tool === 'ERASER') {
      if (currentPath.current.length > 0) {
        newOp = {
          id: Math.random().toString(36).substring(2, 9),
          tool,
          color: tool === 'ERASER' ? '#0a0914' : color,
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

      // Broadcast op to peers
      if (boardId) {
        whiteboardService.sendOp(boardId, newOp)
      } else if (meetingRoomCode) {
        whiteboardService.sendMeetingOp(meetingRoomCode, newOp)
      }
    }

    broadcastCursor(x, y, false)
  }

  // Handle Text Submission
  const handleTextSubmit = () => {
    if (!textInput.value.trim() || readOnly) {
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
      fontSize: strokeWidth * 6 + 12,
      userId: user?.id,
      userName: user?.name,
      timestamp: new Date().toISOString(),
    }

    setOps((prev) => [...prev, newOp])
    setRedoStack([])
    setTextInput((prev) => ({ ...prev, visible: false, value: '' }))

    if (boardId) {
      whiteboardService.sendOp(boardId, newOp)
    } else if (meetingRoomCode) {
      whiteboardService.sendMeetingOp(meetingRoomCode, newOp)
    }
  }

  // Undo / Redo / Clear
  const handleUndo = () => {
    if (ops.length === 0 || readOnly) return
    const lastOp = ops[ops.length - 1]
    setOps((prev) => prev.slice(0, prev.length - 1))
    setRedoStack((prev) => [...prev, lastOp])
  }

  const handleRedo = () => {
    if (redoStack.length === 0 || readOnly) return
    const opToRestore = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, prev.length - 1))
    setOps((prev) => [...prev, opToRestore])

    if (boardId) {
      whiteboardService.sendOp(boardId, opToRestore)
    } else if (meetingRoomCode) {
      whiteboardService.sendMeetingOp(meetingRoomCode, opToRestore)
    }
  }

  const handleClear = () => {
    if (readOnly) return
    if (!window.confirm('Clear the entire whiteboard canvas?')) return
    setOps([])
    setRedoStack([])

    const clearOp: WhiteboardOp = {
      tool: 'CLEAR',
      userId: user?.id,
      userName: user?.name,
      timestamp: new Date().toISOString(),
    }

    if (boardId) {
      whiteboardService.sendOp(boardId, clearOp)
    } else if (meetingRoomCode) {
      whiteboardService.sendMeetingOp(meetingRoomCode, clearOp)
    }
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
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_whiteboard.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // Save to Backend
  const handleSaveToBackend = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataString = JSON.stringify(ops)
    const snapshot = canvas.toDataURL('image/png')
    if (onSave) {
      onSave(dataString, snapshot)
    } else if (boardId) {
      whiteboardService.save(boardId, {
        canvasData: dataString,
        snapshotUrl: snapshot,
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] overflow-hidden select-none bg-[#0a0914] rounded-2xl border border-white/10 shadow-2xl flex flex-col"
    >
      {/* Top Floating Action & Stats Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Title & Active Participants */}
        <div className="pointer-events-auto flex items-center gap-3 bg-[#110e24]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="text-sm font-semibold text-white tracking-wide">{title}</span>
          {meetingRoomCode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Room: {meetingRoomCode}
            </span>
          )}

          {remoteCursors.size > 0 && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/10">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">
                {remoteCursors.size + 1} collaborating
              </span>
            </div>
          )}
        </div>

        {/* View Controls & Export/Save */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#110e24]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="text-xs font-mono px-2 py-1 rounded-md text-white/80 hover:bg-white/10"
            title="Reset View"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            onClick={handleExportPng}
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Export PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={handleSaveToBackend}
            className="flex items-center gap-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg shadow-md transition-all shadow-purple-900/30"
            title="Save Canvas"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Floating Toolbar (Left-aligned) */}
      {!readOnly && (
        <div className="absolute left-4 top-20 z-20 flex flex-col gap-2 bg-[#110e24]/95 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
          {/* Main Drawing Tools */}
          <div className="grid grid-cols-1 gap-1.5">
            <button
              onClick={() => {
                setTool('PEN')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'PEN' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Pen Tool"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTool('ERASER')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'ERASER' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Eraser Tool"
            >
              <Eraser className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTool('LINE')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'LINE' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Line Tool"
            >
              <Minus className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTool('RECTANGLE')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'RECTANGLE' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Rectangle Tool"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTool('CIRCLE')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'CIRCLE' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Circle Tool"
            >
              <Circle className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTool('ARROW')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'ARROW' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Arrow Tool"
            >
              <MoveRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTool('TEXT')
                setIsPanMode(false)
              }}
              className={`p-2.5 rounded-xl transition-all ${
                tool === 'TEXT' && !isPanMode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Text Tool"
            >
              <Type className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPanMode(!isPanMode)}
              className={`p-2.5 rounded-xl transition-all ${
                isPanMode
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Pan / Hand Tool"
            >
              <Hand className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full h-px bg-white/10 my-1" />

          {/* Color Swatches */}
          <div className="grid grid-cols-2 gap-1.5 p-0.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110 opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
                title={`Color: ${c}`}
              />
            ))}
          </div>

          <div className="w-full h-px bg-white/10 my-1" />

          {/* Stroke Width Selector */}
          <div className="flex flex-col gap-1">
            {STROKE_WIDTHS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStrokeWidth(s.value)}
                className={`text-[10px] font-mono py-0.5 rounded transition-colors ${
                  strokeWidth === s.value
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="w-full h-px bg-white/10 my-1" />

          {/* Undo / Redo / Clear Actions */}
          <div className="flex flex-col gap-1">
            <button
              onClick={handleUndo}
              disabled={ops.length === 0}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Clear Canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
          isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
      />

      {/* Inline Text Input overlay */}
      {textInput.visible && (
        <div
          className="absolute z-30 flex items-center gap-2 bg-[#16142a] p-2 rounded-xl border border-purple-500/50 shadow-2xl"
          style={{
            left: `${Math.min(textInput.x, (canvasRef.current?.width || 500) - 260)}px`,
            top: `${Math.min(textInput.y, (canvasRef.current?.height || 500) - 60)}px`,
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
            className="bg-transparent border-none text-white text-sm outline-none px-2 py-1 w-44 font-medium"
            style={{ color }}
          />
          <button
            onClick={handleTextSubmit}
            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-xs text-white rounded-lg font-semibold"
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
                className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-lg animate-pulse"
                style={{ backgroundColor: rc.color || '#a855f7' }}
              />
              {/* Badge Tag */}
              <div
                className="absolute left-4 top-0 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white whitespace-nowrap shadow-md"
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

export default WhiteboardCanvas
