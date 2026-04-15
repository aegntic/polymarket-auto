"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Activity, CircleDot, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  getHealth,
  getCircuitBreaker,
  getModules,
  type SystemHealth,
  type CircuitBreakerState,
  type ModuleStatus,
} from "@/lib/api-collector";

interface Notification {
  id: string;
  type: "alert" | "info" | "success" | "error";
  message: string;
  time: string;
}

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [circuit, setCircuit] = useState<CircuitBreakerState | null>(null);
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, circuitRes, modulesRes] = await Promise.allSettled([
        getHealth(),
        getCircuitBreaker(),
        getModules(),
      ]);

      const notifs: Notification[] = [];
      const now = new Date().toISOString();

      // Health status
      if (healthRes.status === "fulfilled" && healthRes.value.success) {
        const h = healthRes.value.data!;
        setHealth(h);
        if (h.redis === "disconnected") {
          notifs.push({ id: "redis-down", type: "error", message: "Redis disconnected", time: now });
        }
        if (h.clickhouse === "disconnected") {
          notifs.push({ id: "ch-down", type: "error", message: "ClickHouse disconnected", time: now });
        }
        if (h.redis === "connected" && h.clickhouse === "connected") {
          notifs.push({ id: "sys-ok", type: "success", message: "All systems operational", time: now });
        }
      }

      // Circuit breaker alerts
      if (circuitRes.status === "fulfilled" && circuitRes.value.success) {
        const cb = circuitRes.value.data!;
        setCircuit(cb);
        if (cb.level === "red") {
          notifs.push({ id: "cb-red", type: "alert", message: `Circuit breaker RED — ${cb.clonesLastHour} clones/hr (max ${cb.maxPerHour})`, time: now });
        } else if (cb.level === "orange") {
          notifs.push({ id: "cb-orange", type: "alert", message: `Circuit breaker ORANGE — approaching hourly limit (${cb.clonesLastHour}/${cb.maxPerHour})`, time: now });
        } else if (cb.level === "yellow") {
          notifs.push({ id: "cb-yellow", type: "info", message: `Circuit breaker elevated — ${cb.clonesToday} clones today`, time: now });
        } else {
          notifs.push({ id: "cb-green", type: "info", message: `Circuit breaker nominal — ${cb.clonesToday} clones today`, time: now });
        }
      }

      // Module statuses
      if (modulesRes.status === "fulfilled" && modulesRes.value.success) {
        const mods = modulesRes.value.data!;
        setModules(mods);
        const errored = mods.filter((m) => m.status === "error");
        for (const m of errored) {
          notifs.push({ id: `mod-${m.id}`, type: "error", message: `${m.name} module error`, time: now });
        }
        const stopped = mods.filter((m) => m.status === "stopped" && m.enabled);
        for (const m of stopped) {
          notifs.push({ id: `mod-${m.id}-stop`, type: "info", message: `${m.name} module stopped`, time: now });
        }
      }

      setNotifications(notifs);
    } catch {
      setNotifications([{ id: "fetch-err", type: "error", message: "Failed to fetch system status", time: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const alertCount = notifications.filter(
    (n) => n.type === "alert" || n.type === "error"
  ).length;

  const iconForType = (type: Notification["type"]) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-[#eab308]" />;
      case "error":
        return <XCircle className="h-4 w-4 text-[#ef4444]" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-[#22c55e]" />;
      default:
        return <CircleDot className="h-4 w-4 text-[#888]" />;
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "red":
        return "text-[#ef4444]";
      case "orange":
        return "text-[#f97316]";
      case "yellow":
        return "text-[#eab308]";
      default:
        return "text-[#22c55e]";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle className="h-3.5 w-3.5 text-[#22c55e]" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />;
      default:
        return <CircleDot className="h-3.5 w-3.5 text-[#666]" />;
    }
  };

  return (
    <>
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
          <button
            onClick={() => { setNotifOpen(true); fetchNotifications(); }}
            className="relative rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#1a1a1a] hover:text-[#d4af37]"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4af37] p-0 text-[10px] font-bold text-[#0a0a0a]">
                {alertCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => { setStatusOpen(true); fetchNotifications(); }}
            className="rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#1a1a1a] hover:text-[#d4af37]"
          >
            <Activity className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Notifications Sheet */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="border-[rgba(212,175,55,0.12)] bg-[#111]">
          <SheetHeader>
            <SheetTitle className="text-[#f5f5f5]">Notifications</SheetTitle>
            <SheetDescription className="text-[#888]">System alerts and events</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {loading && notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#666]">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#666]">No notifications</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-lg border border-[rgba(212,175,55,0.06)] bg-[rgba(255,255,255,0.02)] p-3"
                  >
                    <div className="mt-0.5 shrink-0">{iconForType(n.type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#ccc]">{n.message}</p>
                      <p className="mt-1 text-xs text-[#555]">
                        {n.time.slice(11, 19)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* System Status Sheet */}
      <Sheet open={statusOpen} onOpenChange={setStatusOpen}>
        <SheetContent side="right" className="border-[rgba(212,175,55,0.12)] bg-[#111]">
          <SheetHeader>
            <SheetTitle className="text-[#f5f5f5]">System Status</SheetTitle>
            <SheetDescription className="text-[#888]">Live infrastructure and module health</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Infrastructure */}
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#666]">Infrastructure</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-[rgba(212,175,55,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                  <span className="text-sm text-[#ccc]">Redis</span>
                  <span className={`text-xs font-medium ${health?.redis === "connected" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {health?.redis ?? "unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[rgba(212,175,55,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                  <span className="text-sm text-[#ccc]">ClickHouse</span>
                  <span className={`text-xs font-medium ${health?.clickhouse === "connected" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {health?.clickhouse ?? "unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Circuit Breaker */}
            {circuit && (
              <div className="mb-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#666]">Circuit Breaker</h3>
                <div className="rounded-lg border border-[rgba(212,175,55,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-[#ccc]">Level</span>
                    <span className={`text-sm font-bold uppercase ${levelColor(circuit.level)}`}>
                      {circuit.level}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#888]">
                    <div className="flex justify-between">
                      <span>Clones last hour</span>
                      <span className="font-mono text-[#ccc]">{circuit.clonesLastHour} / {circuit.maxPerHour}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Clones today</span>
                      <span className="font-mono text-[#ccc]">{circuit.clonesToday} / {circuit.maxPerDay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LLM cost today</span>
                      <span className="font-mono text-[#ccc]">${circuit.llmCostToday.toFixed(2)} / ${circuit.llmBudgetPerDay.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* Capacity bar */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        circuit.level === "red" ? "bg-[#ef4444]" :
                        circuit.level === "orange" ? "bg-[#f97316]" :
                        circuit.level === "yellow" ? "bg-[#eab308]" :
                        "bg-[#22c55e]"
                      }`}
                      style={{ width: `${Math.min(100, (circuit.clonesLastHour / circuit.maxPerHour) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modules */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#666]">Modules</h3>
              <div className="space-y-1">
                {modules.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[#666]">No module data</p>
                ) : (
                  modules.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-[rgba(212,175,55,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {statusIcon(m.status)}
                        <span className="text-sm text-[#ccc]">{m.name}</span>
                      </div>
                      <span className={`text-xs ${m.status === "running" ? "text-[#22c55e]" : m.status === "error" ? "text-[#ef4444]" : "text-[#666]"}`}>
                        {m.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
