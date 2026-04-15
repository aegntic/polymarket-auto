"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Radio,
  Search,
  Rocket,
  ShieldAlert,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon,
  History,
  Crosshair,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "DETECT",
    items: [
      { href: "/signals", label: "Signals", icon: Radio },
      { href: "/classify", label: "Classify", icon: Search },
      { href: "/dataset", label: "Dataset", icon: Database },
    ],
  },
  {
    label: "DEPLOY",
    items: [
      { href: "/deploy", label: "Deploy", icon: Crosshair },
      { href: "/deployments", label: "History", icon: History },
      { href: "/risk", label: "Risk", icon: ShieldAlert },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[rgba(212,175,55,0.08)] bg-[#0d0d0d]"
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[rgba(212,175,55,0.08)] px-4">
        <Hexagon className="h-7 w-7 shrink-0 text-[#d4af37]" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="ml-3 overflow-hidden whitespace-nowrap text-lg font-semibold tracking-wider text-[#d4af37]"
            >
              MAS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {/* Section header */}
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#555]"
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            {/* Section items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                const linkContent = (
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "text-[#d4af37]"
                        : "text-[#888888] hover:text-[#f5f5f5]"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#d4af37]"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        isActive ? "text-[#d4af37]" : "text-[#666666] group-hover:text-[#d4af37]"
                      )}
                    />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a] text-[#f5f5f5]">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={item.href}>{linkContent}</div>;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="border-t border-[rgba(212,175,55,0.08)] px-2 py-2">
        {BOTTOM_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "text-[#d4af37]"
                  : "text-[#888888] hover:text-[#f5f5f5]"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-[#d4af37]" : "text-[#666666] group-hover:text-[#d4af37]"
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a] text-[#f5f5f5]">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="mt-1 flex w-full items-center justify-center rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#1a1a1a] hover:text-[#d4af37]"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
