"use client";

import { cn } from "@/lib/utils";
import type { Chain } from "@/lib/types";

const CHAIN_STYLES: Record<Chain, { bg: string; text: string; label: string }> = {
  solana: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    label: "SOL",
  },
  base: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    label: "BASE",
  },
  bnb: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    label: "BNB",
  },
};

export function ChainBadge({ chain }: { chain: Chain }) {
  const style = CHAIN_STYLES[chain];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        style.bg,
        style.text
      )}
    >
      {style.label}
    </span>
  );
}
