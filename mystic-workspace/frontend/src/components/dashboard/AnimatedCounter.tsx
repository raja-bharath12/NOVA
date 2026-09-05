import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  className?: string
}

export default function AnimatedCounter({ value, className = '' }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (v) => Math.round(v))
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [value])

  useEffect(() => {
    return rounded.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(v)
    })
  }, [rounded])

  return (
    <motion.span ref={ref} className={`luminous-number ${className}`}>
      0
    </motion.span>
  )
}
