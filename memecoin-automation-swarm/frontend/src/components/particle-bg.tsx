"use client";

import { useRef, useMemo, useEffect } from "react";

interface ParticleBackgroundProps {
  activity?: number; // 0-1 scale
}

export function ParticleBackground({ activity = 0.3 }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const particles = useMemo(() => {
    const rng = (() => {
      let s = 98765;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    })();
    return Array.from({ length: 60 }, () => ({
      x: rng() * 100,
      y: rng() * 100,
      vx: (rng() - 0.5) * 0.15,
      vy: (rng() - 0.5) * 0.15,
      size: rng() * 2 + 0.5,
      opacity: rng() * 0.3 + 0.1,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const activeParticles = Math.floor(particles.length * (0.3 + activity * 0.7));

      for (let i = 0; i < activeParticles; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 100) p.vx *= -1;
        if (p.y < 0 || p.y > 100) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(
          (p.x / 100) * canvas.offsetWidth,
          (p.y / 100) * canvas.offsetHeight,
          p.size,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(212, 175, 55, ${p.opacity})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [activity, particles]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={{ opacity: 0.4 }}
    />
  );
}
