import { useEffect, useRef } from 'react'

/**
 * A slow, living background: drifting aurora gradients + soft floating
 * particles + a faint cursor-follow glow. Pure CSS/canvas, no state churn
 * in React so it never causes re-renders elsewhere in the app.
 * Respects prefers-reduced-motion by freezing all motion.
 */
export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const particleCount = Math.min(60, Math.floor((width * height) / 28000))
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
      alpha: Math.random() * 0.5 + 0.15,
    }))

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
    }
    window.addEventListener('resize', resize)

    let raf = 0
    function draw() {
      ctx!.clearRect(0, 0, width, height)
      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0) p.x = width
          if (p.x > width) p.x = 0
          if (p.y < 0) p.y = height
          if (p.y > height) p.y = 0
        }
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(201, 190, 234, ${p.alpha})`
        ctx!.fill()
      }
      if (!reduceMotion) raf = requestAnimationFrame(draw)
    }
    draw()

    function handlePointerMove(e: PointerEvent) {
      if (reduceMotion || !glowRef.current) return
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      glowRef.current.style.background = `radial-gradient(600px circle at ${x}% ${y}%, rgba(131,103,232,0.10), transparent 60%)`
    }
    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-void-950">
      {/* Slow drifting aurora layers */}
      <div className="absolute inset-0 bg-aurora-1 animate-drift-slow" />
      <div className="absolute inset-0 bg-aurora-2 animate-drift" style={{ animationDelay: '-8s' }} />
      <div className="absolute inset-0 bg-aurora-3 animate-drift-slow" style={{ animationDelay: '-16s' }} />

      {/* Fine smoky texture */}
      <div
        className="absolute inset-0 opacity-[0.15] mix-blend-screen"
        style={{
          backgroundImage:
            'repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.02) 0, transparent 2px)',
        }}
      />

      {/* Floating particles canvas */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Cursor-follow ambient glow */}
      <div ref={glowRef} className="absolute inset-0 transition-[background] duration-300" />

      {/* Vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(7,6,11,0.7)_100%)]" />
    </div>
  )
}
