import { useState } from 'react'
import {
  Paintbrush,
  Pencil,
  Eraser,
  PaintBucket,
  RotateCcw,
  Trash2,
  Palette,
} from 'lucide-react'

interface ScribbleToolbarProps {
  currentTool: 'brush' | 'pencil' | 'eraser' | 'fill'
  setTool: (tool: 'brush' | 'pencil' | 'eraser' | 'fill') => void
  currentColor: string
  setColor: (color: string) => void
  currentWidth: number
  setWidth: (w: number) => void
  onClear: () => void
  onUndo: () => void
}

const QUICK_COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#64748B', // Gray
  '#EF4444', // Red
  '#F97316', // Orange
  '#FBBF24', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#78350F', // Brown
  '#14532D', // Dark Green
  '#1E3A8A', // Dark Blue
  '#831843', // Maroon
  '#F43F5E', // Rose
]

const STROKE_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 7 },
  { label: 'L', size: 14 },
  { label: 'XL', size: 24 },
]

export default function ScribbleToolbar({
  currentTool,
  setTool,
  currentColor,
  setColor,
  currentWidth,
  setWidth,
  onClear,
  onUndo,
}: ScribbleToolbarProps) {
  const [showHexInput, setShowHexInput] = useState(false)

  return (
    <div className="w-full bg-[#13141f]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
      {/* 1. Tool Selection */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => setTool('brush')}
          title="Paintbrush"
          className={`p-2 sm:p-2.5 rounded-xl transition-all ${
            currentTool === 'brush'
              ? 'bg-purple-600 text-white shadow-glow'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Paintbrush size={18} />
        </button>

        <button
          onClick={() => setTool('pencil')}
          title="Pencil"
          className={`p-2 sm:p-2.5 rounded-xl transition-all ${
            currentTool === 'pencil'
              ? 'bg-purple-600 text-white shadow-glow'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Pencil size={18} />
        </button>

        <button
          onClick={() => setTool('eraser')}
          title="Eraser"
          className={`p-2 sm:p-2.5 rounded-xl transition-all ${
            currentTool === 'eraser'
              ? 'bg-purple-600 text-white shadow-glow'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <Eraser size={18} />
        </button>

        <button
          onClick={() => setTool('fill')}
          title="Flood Fill Bucket"
          className={`p-2 sm:p-2.5 rounded-xl transition-all ${
            currentTool === 'fill'
              ? 'bg-purple-600 text-white shadow-glow'
              : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
          }`}
        >
          <PaintBucket size={18} />
        </button>
      </div>

      {/* 2. Color Palette Swatches */}
      <div className="flex items-center gap-1.5 flex-wrap max-w-xs sm:max-w-md">
        {QUICK_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border transition-all ${
              currentColor.toLowerCase() === c.toLowerCase()
                ? 'border-white scale-125 ring-2 ring-purple-500 shadow-md'
                : 'border-white/20 hover:scale-110'
            }`}
          />
        ))}

        {/* Custom Hex Color Picker */}
        <div className="relative flex items-center">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded-full cursor-pointer opacity-0 absolute inset-0 z-10"
            title="Custom Hex Color"
          />
          <div
            style={{ backgroundColor: currentColor }}
            className="w-6 h-6 rounded-full border border-white/40 flex items-center justify-center pointer-events-none"
          >
            <Palette size={12} className="text-white/80 mix-blend-difference" />
          </div>
        </div>
      </div>

      {/* 3. Brush Size Selectors */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
        {STROKE_SIZES.map((s) => (
          <button
            key={s.label}
            onClick={() => setWidth(s.size)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              currentWidth === s.size
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 4. Canvas Actions: Undo & Clear */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onUndo}
          title="Undo Last Stroke"
          className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 transition-all active:scale-95"
        >
          <RotateCcw size={16} />
        </button>

        <button
          onClick={onClear}
          title="Clear Entire Canvas"
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all active:scale-95"
        >
          <Trash2 size={15} />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </div>
  )
}
