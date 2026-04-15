"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AppShell({ children, title, description }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delay={0}>
      <div className="min-h-screen bg-[#0a0a0a]">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <motion.div
          initial={false}
          animate={{ marginLeft: collapsed ? 72 : 240 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex min-h-screen flex-col"
        >
          <Header title={title} description={description} />
          <main className="flex-1 p-6">{children}</main>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
