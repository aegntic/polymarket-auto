'use client'

import { useEffect, useRef } from 'react'

const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789$%+=<>{}[]|/\\*#@&'
const FONT_SIZE = 14
const FPS = 15
const FRAME_INTERVAL = 1000 / FPS

export function MatrixRain({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    canvas.width = width
    canvas.height = height

    const columns = Math.floor(width / FONT_SIZE)
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

      ctx.fillStyle = 'rgba(10, 14, 23, 0.12)'
      ctx.fillRect(0, 0, width, height)

      ctx.font = `${FONT_SIZE}px monospace`

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const x = i * FONT_SIZE
        const y = drops[i] * FONT_SIZE

        // Head character (brighter)
        ctx.fillStyle = 'rgba(0, 255, 65, 0.07)'
        ctx.fillText(char, x, y)

        // Trail character (dimmer)
        if (drops[i] > 1) {
          const prevChar = CHARS[Math.floor(Math.random() * CHARS.length)]
          ctx.fillStyle = 'rgba(0, 255, 65, 0.03)'
          ctx.fillText(prevChar, x, y - FONT_SIZE)
        }

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i] += 0.5
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
