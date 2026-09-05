import { type ReactNode, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  tilt?: boolean
}

/**
 * Layered glass surface used throughout the app in place of ordinary cards.
 * Optionally tilts subtly toward the cursor for a living, dimensional feel.
 */
export default function GlassPanel({ children, className = '', tilt = false }: GlassPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState({})

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!tilt || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setStyle({
      transform: `perspective(800px) rotateX(${y * -4}deg) rotateY(${x * 4}deg)`,
    })
  }

  function handleMouseLeave() {
    if (!tilt) return
    setStyle({ transform: 'perspective(800px) rotateX(0) rotateY(0)' })
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`glass-panel p-6 transition-transform duration-300 ease-out ${className}`}
    >
      {children}
    </motion.div>
  )
}
