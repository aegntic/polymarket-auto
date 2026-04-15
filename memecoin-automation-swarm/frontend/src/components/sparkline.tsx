"use client";

import { useMemo } from "react";

function createPrng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface SparklineProps {
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
  seed?: number;
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color = "#d4af37",
  seed = 42,
}: SparklineProps) {
  const points = useMemo(() => {
    if (data) return data;
    const rng = createPrng(seed);
    const pts: number[] = [];
    let val = 50;
    for (let i = 0; i < 20; i++) {
      val += (rng() - 0.48) * 20;
      val = Math.max(10, Math.min(90, val));
      pts.push(val);
    }
    return pts;
  }, [data, seed]);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pathData = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}
