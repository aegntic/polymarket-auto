"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { ChainBadge } from "@/components/chain-badge";
import { ParticleBackground } from "@/components/particle-bg";
import {
  Search,
  Copy,
  DollarSign,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { evaluateQuickDecision } from "@/lib/decision-engine";
import { getSignals, getCircuitBreaker } from "@/lib/api-collector";
import type { Chain } from "@/lib/mock-data";

interface SignalData {
  id: string;
  address: string;
  symbol: string;
  chain: Chain;
  score: number;
}

interface CBState {
  level: string;
  clonesLastHour: number;
  maxPerHour: number;
  clonesToday: number;
  maxPerDay: number;
}

export default function DashboardPage() {
  const [decision, setDecision] = useState<ReturnType<typeof evaluateQuickDecision> | null>(null);
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [cb, setCB] = useState<CBState | null>(null);
  const [loading, setLoading] = useState({ signals: true, cb: true });
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([getSignals({ limit: 8 }), getCircuitBreaker()])
      .then((results) => {
        const [signalsRes, cbRes] = results;

        if (signalsRes.status === "fulfilled" && signalsRes.value?.success) {
          const data = signalsRes.value.data || [];
          setSignals(data);
          setDecision(
            evaluateQuickDecision({
              volume24h: data.reduce(
                (s: number, d: any) => s + (d.volume24h || 0),
                0,
              ),
              age: "12",
              socialMentions: data.reduce(
                (s: number, d: any) => s + ((d.score || 0) > 0.7 ? 1 : 0),
                0,
              ),
              priceChange24h: 0.15,
            }),
          );
        }

        if (cbRes.status === "fulfilled" && cbRes.value?.success) {
          setCB(cbRes.value.data || null);
        }

        setLoading({ signals: false, cb: false });
      })
      .catch(() => {
        setLoading({ signals: false, cb: false });
      });

    setActivity(
      Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        classified: Math.floor(Math.random() * 20) + 5,
        clones: Math.floor(Math.random() * 5),
        cost: Math.random() * 0.5 + 0.05,
      })),
    );
  }, []);

  if (loading.signals || loading.cb) {
    return (
      <AppShell title="Dashboard" description="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
        </div>
      </AppShell>
    );
  }

  const tokensClassified = activity.reduce(
    (s, d) => s + (d.classified || 0),
    0,
  );
  const clonesDetected = activity.reduce((s, d) => s + (d.clones || 0), 0);
  const llmCost = activity.reduce(
    (s, d) => s + parseFloat(String(d.cost || 0)),
    0,
  );

  return (
    <AppShell
      title="Dashboard"
      description="Memecoin Automation Swarm — Overview"
    >
      <ParticleBackground
        activity={cb?.clonesLastHour ? cb.clonesLastHour / cb.maxPerHour : 0.3}
      />

      <div className="relative z-10 mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tokens Classified"
          value={tokensClassified.toLocaleString()}
          sublabel="+12% vs yesterday"
          trend="up"
          icon={<Search className="h-5 w-5" />}
        />
        <StatCard
          label="Clones Detected"
          value={clonesDetected.toLocaleString()}
          sublabel="3 high-risk in last hour"
          trend="up"
          icon={<Copy className="h-5 w-5" />}
        />
        <StatCard
          label="LLM Cost Today"
          value={`$${llmCost.toFixed(2)}`}
          sublabel={`of $10 daily budget`}
          trend="neutral"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Circuit Breaker"
          value={cb?.level?.toUpperCase() || "—"}
          sublabel={`${cb?.clonesLastHour || 0}/${cb?.maxPerHour || 0} per hour`}
          trend={
            cb?.level === "green"
              ? "up"
              : cb?.level === "red"
                ? "down"
                : "neutral"
          }
          icon={<ShieldAlert className="h-5 w-5" />}
        />
      </div>

      <div className="relative z-10 mb-6">
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888888]">
              <TrendingUp className="h-4 w-4 text-[#d4af37]" />
              Activity (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#666", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#666", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid rgba(212,175,55,0.15)",
                    borderRadius: 8,
                    color: "#f5f5f5",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="classified"
                  stroke="#d4af37"
                  strokeWidth={2}
                  fill="url(#goldGrad)"
                  name="Classified"
                />
                <Area
                  type="monotone"
                  dataKey="clones"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#greenGrad)"
                  name="Clones"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="relative z-10 mb-6">
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888888]">
              <Zap className="h-4 w-4 text-[#d4af37]" />
              Recent Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[240px]">
              <div className="space-y-3">
                {decision ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <ChainBadge chain={decision.chain as Chain} />
                      <div>
                        <p className="font-medium text-[#f5f5f5]">
                          Recommended Deployment
                        </p>
                        <p className="text-xs text-[#666]">
                          Expected multiple:{" "}
                          {decision.expectedMultiple.toFixed(2)}x
                        </p>
                        <p className="text-xs text-[#666]">
                          Investment: ${decision.investment.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`border-0 text-xs ${decision.expectedMultiple >= 3.5 ? "bg-[#ef4444]/10 text-[#ef4444]" : decision.expectedMultiple >= 3.2 ? "bg-[#eab308]/10 text-[#eab308]" : "bg-[#22c55e]/10 text-[#22c55e]"}`}
                    >
                      {decision.expectedMultiple.toFixed(2)}x
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-[#666]">Analyzing signals...</p>
                )}
                {signals.slice(0, 6).map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <ChainBadge chain={signal.chain} />
                      <div>
                        <p className="font-medium text-[#f5f5f5]">
                          {signal.symbol}
                        </p>
                        <p className="text-xs text-[#666]">{signal.address}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`border-0 text-xs ${signal.score >= 0.8 ? "bg-[#ef4444]/10 text-[#ef4444]" : signal.score >= 0.5 ? "bg-[#eab308]/10 text-[#eab308]" : "bg-[#22c55e]/10 text-[#22c55e]"}`}
                    >
                      {signal.score.toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
