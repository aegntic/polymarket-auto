"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "glass-panel card-gold-hover rounded-xl p-5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[#888888]">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[#f5f5f5]">
            {value}
          </p>
          {sublabel && (
            <p
              className={cn(
                "text-xs",
                trend === "up" && "text-[#22c55e]",
                trend === "down" && "text-[#ef4444]",
                trend === "neutral" && "text-[#888888]",
                !trend && "text-[#888888]"
              )}
            >
              {sublabel}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-[rgba(212,175,55,0.08)] p-2.5 text-[#d4af37]">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
