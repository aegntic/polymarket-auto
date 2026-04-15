"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  getSignals,
  getCircuitBreaker,
  getAnalysisMetrics,
  type TokenSignal,
} from "@/lib/api-collector";
import type { Chain } from "@/lib/types";

interface CBState {
  level: string;
  clonesLastHour: number;
  maxPerHour: number;
  clonesToday: number;
  maxPerDay: number;
  llmCostToday: number;
  llmBudgetPerDay: number;
}

interface ActivityBucket {
  time: string;
  classified: number;
  clones: number;
  cost: number;
}

/**
 * Bucket signal timestamps into hourly slots for the last 24 hours.
 * Each signal counts as one classification; signals with score >= 0.7 are
 * also counted as clones.  Cost is estimated at $0.008 per classification
 * (roughly the per-request cost of a small LLM call).
 */
function bucketSignals(signals: TokenSignal[]): ActivityBucket[] {
  const COST_PER_CLASSIFICATION = 0.008;
  const now = new Date();
  const buckets: Map<string, ActivityBucket> = new Map();

  // Initialise 24 empty buckets (0..23) from 24h ago to now.
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600000);
    const key = `${t.getHours().toString().padStart(2, "0")}:00`;
    buckets.set(key, { time: key, classified: 0, clones: 0, cost: 0 });
  }

  for (const sig of signals) {
    const d = new Date(sig.detectedAt);
    const ageMs = now.getTime() - d.getTime();
    if (ageMs < 0 || ageMs > 24 * 3600000) continue;

    const key = `${d.getHours().toString().padStart(2, "0")}:00`;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.classified += 1;
    bucket.cost = Math.round((bucket.cost + COST_PER_CLASSIFICATION) * 1000) / 1000;
    if (sig.score >= 0.7) {
      bucket.clones += 1;
    }
  }

  return Array.from(buckets.values());
}

export default function DashboardPage() {
  const [decision, setDecision] = useState<ReturnType<typeof evaluateQuickDecision> | null>(null);
  const [signals, setSignals] = useState<TokenSignal[]>([]);
  const [cb, setCB] = useState<CBState | null>(null);
  const [loading, setLoading] = useState({ signals: true, cb: true });
  const [metricsData, setMetricsData] = useState<{
    classifications: number;
    cloneCount: number;
    llmCostToday: number;
    llmBudgetPerDay: number;
  } | null>(null);

  useEffect(() => {
    Promise.allSettled([
      getSignals({ limit: 50 }),
      getCircuitBreaker(),
      getAnalysisMetrics(),
    ])
      .then((results) => {
        const [signalsRes, cbRes, metricsRes] = results;

        if (signalsRes.status === "fulfilled" && signalsRes.value?.success) {
          const data = signalsRes.value.data || [];
          setSignals(data);
          setDecision(
            evaluateQuickDecision({
              volume24h: data.reduce(
                (s, d) => s + (d.volume24h || 0),
                0,
              ),
              age: "12",
              socialMentions: data.reduce(
                (s, d) => s + (d.score > 0.7 ? 1 : 0),
                0,
              ),
              priceChange24h: 0.15,
            }),
          );
        }

        if (cbRes.status === "fulfilled" && cbRes.value?.success) {
          const cbData = cbRes.value.data || null;
          setCB(cbData);

          // Also extract clone count from circuit breaker if available.
          if (cbData) {
            setMetricsData((prev) => ({
              classifications: prev?.classifications ?? 0,
              cloneCount: cbData.clonesToday,
              llmCostToday: cbData.llmCostToday,
              llmBudgetPerDay: cbData.llmBudgetPerDay,
            }));
          }
        }

        if (metricsRes.status === "fulfilled" && metricsRes.value?.success && metricsRes.value.data) {
          const m = metricsRes.value.data;
          setMetricsData((prev) => ({
            classifications: m.classifications,
            cloneCount: prev?.cloneCount ?? 0,
            llmCostToday: prev?.llmCostToday ?? 0,
            llmBudgetPerDay: prev?.llmBudgetPerDay ?? 10,
          }));
        }

        setLoading({ signals: false, cb: false });
      })
      .catch(() => {
        setLoading({ signals: false, cb: false });
      });
  }, []);

  const activity = useMemo(() => bucketSignals(signals), [signals]);

  const hasActivity = activity.some((b) => b.classified > 0);

  // Derive stat card values from real data.
  const tokensClassified = metricsData?.classifications ?? 0;
  const clonesDetected = metricsData?.cloneCount ?? signals.filter((s) => s.score >= 0.7).length;
  const llmCostToday = metricsData?.llmCostToday ?? 0;
  const llmBudgetPerDay = metricsData?.llmBudgetPerDay ?? 10;

  if (loading.signals || loading.cb) {
    return (
      <AppShell title="Dashboard" description="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
        </div>
      </AppShell>
    );
  }

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
          sublabel={`${activity.reduce((s, b) => s + b.classified, 0)} in last 24h`}
          trend={tokensClassified > 0 ? "up" : "neutral"}
          icon={<Search className="h-5 w-5" />}
        />
        <StatCard
          label="Clones Detected"
          value={clonesDetected.toLocaleString()}
          sublabel={`${signals.filter((s) => s.score >= 0.7).length} high-risk signals`}
          trend={clonesDetected > 0 ? "up" : "neutral"}
          icon={<Copy className="h-5 w-5" />}
        />
        <StatCard
          label="LLM Cost Today"
          value={`$${llmCostToday.toFixed(2)}`}
          sublabel={`of $${llmBudgetPerDay.toFixed(0)} daily budget`}
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
            {!hasActivity ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-[#666]">
                Run live ingest to populate activity data
              </div>
            ) : (
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
            )}
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
