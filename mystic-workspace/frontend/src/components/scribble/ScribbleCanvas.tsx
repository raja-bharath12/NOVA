import { useEffect, useRef, useCallback, useState } from 'react'
import type { DrawAction, DrawPoint } from '../../types/scribble'

interface ScribbleCanvasProps {
  isDrawer: boolean
  currentTool: 'brush' | 'pencil' | 'eraser' | 'fill'
  currentColor: string
  currentWidth: number
  onEmitDrawAction: (action: DrawAction) => void
  incomingAction: DrawAction | null
  initialActions?: DrawAction[]
}

export default function ScribbleCanvas({
  isDrawer,
  currentTool,
  currentColor,
  currentWidth,
  onEmitDrawAction,
  incomingAction,
  initialActions = [],
}: ScribbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef<boolean>(false)
  const currentPointsRef = useRef<DrawPoint[]>([])
  const historyRef = useRef<DrawAction[]>([])

  // Setup HiDPI canvas & redraw history
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    // Clear with crisp white canvas background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    // Replay actions
    historyRef.current.forEach((action) => {
      renderAction(ctx, action, w, h)
    })
  }, [])

  // Handle resizing with Retina DPR
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return

    const rect = canvas.parentElement.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    redrawAll()
  }, [redrawAll])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  // Load initial snapshot actions if any
  useEffect(() => {
    if (initialActions && initialActions.length > 0) {
      historyRef.current = [...initialActions]
      redrawAll()
    }
  }, [initialActions, redrawAll])

  // Handle incoming remote stroke actions
  useEffect(() => {
    if (!incomingAction) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    if (incomingAction.type === 'CLEAR') {
      historyRef.current = []
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)
    } else if (incomingAction.type === 'UNDO') {
      historyRef.current.pop()
      redrawAll()
    } else {
      historyRef.current.push(incomingAction)
      renderAction(ctx, incomingAction, w, h)
    }
  }, [incomingAction, redrawAll])

  // Render a specific draw action
  const renderAction = (
    ctx: CanvasRenderingContext2D,
    action: DrawAction,
    canvasW: number,
    canvasH: number
  ) => {
    if (action.type === 'FILL' && action.fillPoint && action.color) {
      const px = Math.round(action.fillPoint.x * canvasW)
      const py = Math.round(action.fillPoint.y * canvasH)
      floodFill(ctx, px, py, hexToRgb(action.color), canvasW, canvasH)
      return
    }

    if (!action.points || action.points.length === 0) return

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (action.tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF'
      ctx.fillStyle = '#FFFFFF'
    } else {
      ctx.strokeStyle = action.color || '#000000'
      ctx.fillStyle = action.color || '#000000'
    }

    const dpr = window.devicePixelRatio || 1
    const baseW = (action.width || 4) * dpr
    ctx.lineWidth = action.tool === 'pencil' ? Math.max(1, baseW * 0.75) : baseW

    const points = action.points
    if (points.length === 1) {
      const p = points[0]
      const px = p.x * canvasW
      const py = p.y * canvasH
      ctx.beginPath()
      ctx.arc(px, py, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    // Bézier curve smoothing between points
    ctx.beginPath()
    ctx.moveTo(points[0].x * canvasW, points[0].y * canvasH)

    for (let i = 1; i < points.length - 1; i++) {
      const xc = ((points[i].x + points[i + 1].x) / 2) * canvasW
      const yc = ((points[i].y + points[i + 1].y) / 2) * canvasH
      ctx.quadraticCurveTo(points[i].x * canvasW, points[i].y * canvasH, xc, yc)
    }

    const last = points[points.length - 1]
    ctx.lineTo(last.x * canvasW, last.y * canvasH)
    ctx.stroke()
    ctx.restore()
  }

  // Flood fill algorithm
  const floodFill = (
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    fillColor: { r: number; g: number; b: number; a: number },
    width: number,
    height: number
  ) => {
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data

    const startIndex = (startY * width + startX) * 4
    const startR = data[startIndex]
    const startG = data[startIndex + 1]
    const startB = data[startIndex + 2]
    const startA = data[startIndex + 3]

    if (
      Math.abs(startR - fillColor.r) < 5 &&
      Math.abs(startG - fillColor.g) < 5 &&
      Math.abs(startB - fillColor.b) < 5
    ) {
      return
    }

    const matchStart = (idx: number) => {
      return (
        Math.abs(data[idx] - startR) < 32 &&
        Math.abs(data[idx + 1] - startG) < 32 &&
        Math.abs(data[idx + 2] - startB) < 32
      )
    }

    const pixelStack: [number, number][] = [[startX, startY]]
    const seen = new Uint8Array(width * height)

    while (pixelStack.length > 0) {
      const [curX, curY] = pixelStack.pop()!
      let y1 = curY

      while (y1 >= 0 && matchStart((y1 * width + curX) * 4)) {
        y1--
      }
      y1++

      let spanLeft = false
      let spanRight = false

      while (y1 < height && matchStart((y1 * width + curX) * 4)) {
        const idx = (y1 * width + curX) * 4
        data[idx] = fillColor.r
        data[idx + 1] = fillColor.g
        data[idx + 2] = fillColor.b
        data[idx + 3] = fillColor.a
        seen[y1 * width + curX] = 1

        if (curX > 0) {
          const leftIdx = (y1 * width + (curX - 1)) * 4
          if (!seen[y1 * width + (curX - 1)] && matchStart(leftIdx)) {
            if (!spanLeft) {
              pixelStack.push([curX - 1, y1])
              spanLeft = true
            }
          } else if (spanLeft) {
            spanLeft = false
          }
        }

        if (curX < width - 1) {
          const rightIdx = (y1 * width + (curX + 1)) * 4
          if (!seen[y1 * width + (curX + 1)] && matchStart(rightIdx)) {
            if (!spanRight) {
              pixelStack.push([curX + 1, y1])
              spanRight = true
            }
          } else if (spanRight) {
            spanRight = false
          }
        }

        y1++
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }

  const hexToRgb = (hex: string) => {
    let c = hex.replace('#', '')
    if (c.length === 3) c = c.split('').map((x) => x + x).join('')
    const num = parseInt(c, 16)
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 255,
    }
  }

  // Pointer & Touch coordinate normalizer
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): DrawPoint => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top

    return {
      x: Math.max(0, Math.min(1, rawX / rect.width)),
      y: Math.max(0, Math.min(1, rawY / rect.height)),
    }
  }

  // --- Interaction Handlers (Only enabled when isDrawer is true) ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)

    const pt = getNormalizedPoint(e)

    if (currentTool === 'fill') {
      const fillAction: DrawAction = {
        type: 'FILL',
        fillPoint: pt,
        color: currentColor,
        timestamp: Date.now(),
      }
      historyRef.current.push(fillAction)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) renderAction(ctx, fillAction, canvas.width, canvas.height)
      onEmitDrawAction(fillAction)
      return
    }

    isDrawingRef.current = true
    currentPointsRef.current = [pt]

    const startAction: DrawAction = {
      type: 'START',
      points: [pt],
      color: currentColor,
      width: currentWidth,
      tool: currentTool,
      timestamp: Date.now(),
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) renderAction(ctx, startAction, canvas.width, canvas.height)
    onEmitDrawAction(startAction)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const pt = getNormalizedPoint(e)
    const points = currentPointsRef.current
    const prev = points[points.length - 1]

    // Minimum distance filter to avoid redundant points
    const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y)
    if (dist < 0.003) return

    points.push(pt)

    // Render locally immediately
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx && points.length >= 2) {
      const strokeAction: DrawAction = {
        type: 'STROKE',
        points: points.slice(-3), // Send last segment for live sync
        color: currentColor,
        width: currentWidth,
        tool: currentTool,
        timestamp: Date.now(),
      }
      renderAction(ctx, strokeAction, canvas.width, canvas.height)
      onEmitDrawAction(strokeAction)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return
    isDrawingRef.current = false

    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }

    const points = currentPointsRef.current
    if (points.length > 0) {
      const completeStroke: DrawAction = {
        type: 'STROKE',
        points: [...points],
        color: currentColor,
        width: currentWidth,
        tool: currentTool,
        timestamp: Date.now(),
      }
      historyRef.current.push(completeStroke)
      onEmitDrawAction({ type: 'END', timestamp: Date.now() })
    }
    currentPointsRef.current = []
  }

  return (
    <div className="relative w-full h-full bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-white/20 select-none touch-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full block ${
          isDrawer
            ? currentTool === 'fill'
              ? 'cursor-crosshair'
              : currentTool === 'eraser'
              ? 'cursor-cell'
              : 'cursor-crosshair'
            : 'cursor-default'
        }`}
      />

      {!isDrawer && (
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 text-xs font-medium pointer-events-none flex items-center gap-1.5 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Spectator View</span>
        </div>
      )}
    </div>
  )
}
