'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Cpu,
  X,
} from 'lucide-react'
import { useDashboardStore, type Toast } from '@/lib/store'

// ──────────────────────────────────────────────
// Type Configuration
// ──────────────────────────────────────────────

const TYPE_CONFIG: Record<
  Toast['type'],
  { icon: React.ElementType; color: string; defaultDuration: number }
> = {
  success: { icon: CheckCircle2, color: '#00ff41', defaultDuration: 3000 },
  warning: { icon: AlertTriangle, color: '#f59e0b', defaultDuration: 6000 },
  error: { icon: XCircle, color: '#ef4444', defaultDuration: 8000 },
  info: { icon: Info, color: '#22d3ee', defaultDuration: 4000 },
  system: { icon: Cpu, color: '#a855f7', defaultDuration: 5000 },
}

// ──────────────────────────────────────────────
// Individual Toast Item
// ──────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useDashboardStore((s) => s.removeToast)
  const config = TYPE_CONFIG[toast.type]
  const Icon = config.icon
  const color = config.color
  const duration = toast.duration ?? config.defaultDuration

  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(100)
  const [remainingMs, setRemainingMs] = useState(duration)
  const rafRef = useRef<number>(0)
  const lastTickRef = useRef<number>(Date.now())
  const remainingRef = useRef(duration)

  // Auto-dismiss countdown
  useEffect(() => {
    remainingRef.current = remainingMs

    const tick = () => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now

      if (!paused) {
        remainingRef.current = Math.max(0, remainingRef.current - delta)
        setRemainingMs(remainingRef.current)
        setProgress((remainingRef.current / duration) * 100)

        if (remainingRef.current <= 0) {
          removeToast(toast.id)
          return
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    lastTickRef.current = Date.now()
    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [paused, duration, toast.id, removeToast])

  const handleMouseEnter = useCallback(() => {
    setPaused(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setPaused(false)
    lastTickRef.current = Date.now()
  }, [])

  const handleClose = useCallback(() => {
    removeToast(toast.id)
  }, [toast.id, removeToast])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#1e293b]/80 bg-[#0f1724]/95 backdrop-blur-xl shadow-lg"
      style={{
        borderLeftWidth: '2px',
        borderLeftColor: color,
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md text-[#64748b] opacity-0 transition-all hover:bg-[#1e293b]/60 hover:text-[#94a3b8] group-hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Content */}
      <div className="flex items-start gap-3 p-4 pr-8">
        {/* Type icon */}
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>

        {/* Title + Description */}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight text-[#e2e8f0]">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#94a3b8]/80">
              {toast.description}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-[#1e293b]/60">
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: color,
            opacity: 0.7,
          }}
        />
      </div>
    </motion.div>
  )
}

// ──────────────────────────────────────────────
// Toast Container
// ──────────────────────────────────────────────

export function ToastNotificationSystem() {
  const toasts = useDashboardStore((s) => s.toasts)

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
