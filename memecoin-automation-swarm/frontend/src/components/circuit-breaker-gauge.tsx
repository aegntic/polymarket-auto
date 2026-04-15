"use client";

import { cn } from "@/lib/utils";
import type { CircuitBreakerLevel } from "@/lib/mock-data";

const LEVEL_CONFIG: Record<
  CircuitBreakerLevel,
  { color: string; glow: string; label: string }
> = {
  green: {
    color: "#22c55e",
    glow: "rgba(34, 197, 94, 0.3)",
    label: "NOMINAL",
  },
  yellow: {
    color: "#eab308",
    glow: "rgba(234, 179, 8, 0.3)",
    label: "CAUTION",
  },
  orange: {
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.3)",
    label: "WARNING",
  },
  red: {
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.3)",
    label: "HALT",
  },
};

interface CircuitBreakerGaugeProps {
  level: CircuitBreakerLevel;
  value: number;
  max: number;
  size?: number;
}

export function CircuitBreakerGauge({
  level,
  value,
  max,
  size = 180,
}: CircuitBreakerGaugeProps) {
  const config = LEVEL_CONFIG[level];
  const percentage = Math.min(value / max, 1);
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const filledArc = circumference * 0.75; // 270 degrees
  const progressArc = filledArc * percentage;
  const offset = filledArc - progressArc;

  // Watch-dial tick marks
  const ticks = [];
  const numTicks = 27;
  const startAngle = 135;
  const endAngle = 405;
  for (let i = 0; i <= numTicks; i++) {
    const angle = startAngle + (i / numTicks) * (endAngle - startAngle);
    const rad = (angle * Math.PI) / 180;
    const innerR = radius - 12;
    const outerR = radius - 6;
    ticks.push({
      x1: size / 2 + innerR * Math.cos(rad),
      y1: size / 2 + innerR * Math.sin(rad),
      x2: size / 2 + outerR * Math.cos(rad),
      y2: size / 2 + outerR * Math.sin(rad),
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
      >
        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="rgba(212,175,55,0.15)"
            strokeWidth={1}
          />
        ))}

        {/* Background arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledArc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(135, ${size / 2}, ${size / 2})`}
        />

        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progressArc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(135, ${size / 2}, ${size / 2})`}
          style={{
            filter: `drop-shadow(0 0 6px ${config.glow})`,
            transition: "stroke-dasharray 0.8s ease, stroke 0.3s ease",
          }}
        />

        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          className="fill-[#f5f5f5] text-3xl font-semibold"
          style={{ fontSize: "28px", fontFamily: "Inter" }}
        >
          {value}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          className="fill-[#888888] text-xs uppercase tracking-widest"
          style={{ fontSize: "11px", fontFamily: "Inter" }}
        >
          / {max} per hour
        </text>
        <text
          x={size / 2}
          y={size / 2 + 34}
          textAnchor="middle"
          style={{
            fontSize: "12px",
            fontFamily: "Inter",
            fontWeight: 700,
            fill: config.color,
            letterSpacing: "0.1em",
          }}
        >
          {config.label}
        </text>
      </svg>
    </div>
  );
}
