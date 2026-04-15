"use client";

import { cn } from "@/lib/utils";

interface ConfidenceGaugeProps {
  value: number; // 0-1
  size?: number;
}

export function ConfidenceGauge({ value, size = 120 }: ConfidenceGaugeProps) {
  const percentage = Math.round(value * 100);
  const strokeWidth = 6;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const filledArc = circumference * 0.75;
  const progressArc = filledArc * value;
  const color =
    value >= 0.8 ? "#22c55e" : value >= 0.6 ? "#eab308" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background */}
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
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progressArc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(135, ${size / 2}, ${size / 2})`}
          style={{
            filter: `drop-shadow(0 0 4px ${color}40)`,
            transition: "all 0.6s ease",
          }}
        />
        <text
          x={size / 2}
          y={size / 2 + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: "22px", fontFamily: "Inter", fontWeight: 600 }}
          className="fill-[#f5f5f5]"
        >
          {percentage}%
        </text>
      </svg>
      <span className="text-xs uppercase tracking-wider text-[#888888]">
        Confidence
      </span>
    </div>
  );
}
