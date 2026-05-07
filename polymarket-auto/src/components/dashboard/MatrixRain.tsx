'use client'

import { useEffect, useRef } from 'react'

const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789$%+=<>{}[]|/\\*#@&'
const FONT_SIZE = 16 // Increased size = fewer columns
const FPS = 12 // Reduced FPS
const FRAME_INTERVAL = 1000 / FPS

export function MatrixRain({ enabled = false }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false }) // Disable alpha for better perf
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    canvas.width = width
    canvas.height = height

    // Reduced column density (every 2nd column)
    const columns = Math.floor(width / (FONT_SIZE * 1.5))
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.random() * -100
    )

    let lastFrame = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }
    window.addEventListener('resize', resize)

    const draw = (timestamp: number) => {
      animRef.current = requestAnimationFrame(draw)

      if (timestamp - lastFrame < FRAME_INTERVAL) return
      lastFrame = timestamp

      // Semi-transparent background for trail effect (using solid color with low opacity)
      ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'
      ctx.fillRect(0, 0, width, height)

      ctx.font = `${FONT_SIZE}px monospace`
      ctx.fillStyle = '#003300' // Dim green for characters

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const x = i * FONT_SIZE * 1.5
        const y = drops[i] * FONT_SIZE

        // Render char
        ctx.fillText(char, x, y)

        if (y > height && Math.random() > 0.98) {
          drops[i] = 0
        }
        drops[i] += 0.4
      }
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.5 }}
    />
  )
}
