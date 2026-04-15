"use client";

import { Bell, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[rgba(212,175,55,0.08)] bg-[#0a0a0a]/80 px-6 backdrop-blur-md">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#f5f5f5]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[#888888]">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-[#888888]">
          <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse-gold" />
          System Operational
        </div>
        <button className="relative rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#1a1a1a] hover:text-[#d4af37]">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4af37] p-0 text-[10px] font-bold text-[#0a0a0a]">
            3
          </Badge>
        </button>
        <button className="rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#1a1a1a] hover:text-[#d4af37]">
          <Activity className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
