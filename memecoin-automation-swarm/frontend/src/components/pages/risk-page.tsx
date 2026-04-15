"use client";

import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { CircuitBreakerGauge } from "@/components/circuit-breaker-gauge";
import { generateCircuitBreaker, generateActivityData } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ShieldAlert,
  DollarSign,
  Layers,
  AlertTriangle,
} from "lucide-react";

export default function RiskPage() {
  const cb = generateCircuitBreaker();
  const hourly = generateActivityData(24);

  const hourlyRateData = hourly.map((h) => ({
    time: h.time,
    rate: h.clones,
  }));

  const clonePercent = Math.round((cb.clonesToday / cb.maxPerDay) * 100);
  const budgetPercent = Math.round(
    (cb.llmCostToday / cb.llmBudgetPerDay) * 100
  );

  return (
    <AppShell title="Risk" description="Circuit breaker, daily limits, and budget tracking">
      {/* Top Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Circuit Breaker"
          value={cb.level.toUpperCase()}
          sublabel={`${cb.clonesLastHour}/${cb.maxPerHour} per hour`}
          trend={
            cb.level === "green" ? "up" : cb.level === "red" ? "down" : "neutral"
          }
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <StatCard
          label="Clones Today"
          value={`${cb.clonesToday}/${cb.maxPerDay}`}
          sublabel={`${clonePercent}% of daily limit`}
          trend={clonePercent > 80 ? "down" : "neutral"}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatCard
          label="LLM Budget"
          value={`$${cb.llmCostToday.toFixed(2)}`}
          sublabel={`of $${cb.llmBudgetPerDay.toFixed(2)} daily`}
          trend={budgetPercent > 80 ? "down" : "neutral"}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Risk Score"
          value={
            cb.level === "green"
              ? "LOW"
              : cb.level === "yellow"
              ? "MEDIUM"
              : cb.level === "orange"
              ? "HIGH"
              : "CRITICAL"
          }
          sublabel="System risk assessment"
          trend={cb.level === "green" ? "up" : "down"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Circuit Breaker Gauge */}
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
              <ShieldAlert className="h-4 w-4 text-[#d4af37]" />
              Circuit Breaker Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 pb-8">
            <CircuitBreakerGauge
              level={cb.level}
              value={cb.clonesLastHour}
              max={cb.maxPerHour}
              size={220}
            />
            <div className="grid w-full grid-cols-4 gap-2 text-center text-xs text-[#888]">
              <div className="rounded-lg bg-[#22c55e]/5 p-2">
                <span className="cb-green font-bold">GREEN</span>
                <p className="mt-1 text-[10px]">Normal</p>
              </div>
              <div className="rounded-lg bg-[#eab308]/5 p-2">
                <span className="cb-yellow font-bold">YELLOW</span>
                <p className="mt-1 text-[10px]">&gt;30/hr</p>
              </div>
              <div className="rounded-lg bg-[#f97316]/5 p-2">
                <span className="cb-orange font-bold">ORANGE</span>
                <p className="mt-1 text-[10px]">&gt;40/hr</p>
              </div>
              <div className="rounded-lg bg-[#ef4444]/5 p-2">
                <span className="cb-red font-bold">RED</span>
                <p className="mt-1 text-[10px]">Halt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Limits */}
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
              <Layers className="h-4 w-4 text-[#d4af37]" />
              Daily Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Clones per day */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Clone Deployments</span>
                <span className="font-medium text-[#f5f5f5]">
                  {cb.clonesToday} / {cb.maxPerDay}
                </span>
              </div>
              <Progress
                value={clonePercent}
                className="h-2 bg-[rgba(255,255,255,0.05)] [&>[data-slot=indicator]]:bg-[#d4af37]"
              />
              <p className="text-xs text-[#666]">
                {cb.maxPerDay - cb.clonesToday} remaining today
              </p>
            </div>

            <Separator className="bg-[rgba(212,175,55,0.08)]" />

            {/* LLM Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">LLM Budget</span>
                <span className="font-medium text-[#f5f5f5]">
                  ${cb.llmCostToday.toFixed(2)} / ${cb.llmBudgetPerDay.toFixed(2)}
                </span>
              </div>
              <Progress
                value={budgetPercent}
                className={`h-2 bg-[rgba(255,255,255,0.05)] ${
                  budgetPercent > 80
                    ? "[&>[data-slot=indicator]]:bg-[#ef4444]"
                    : "[&>[data-slot=indicator]]:bg-[#d4af37]"
                }`}
              />
              <p className="text-xs text-[#666]">
                ${(cb.llmBudgetPerDay - cb.llmCostToday).toFixed(2)} remaining
              </p>
            </div>

            <Separator className="bg-[rgba(212,175,55,0.08)]" />

            {/* Hourly Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">Current Rate</span>
                <span className="font-medium text-[#f5f5f5]">
                  {cb.clonesLastHour}/hr
                </span>
              </div>
              <div className="h-2 rounded-full bg-[rgba(255,255,255,0.05)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(cb.clonesLastHour / cb.maxPerHour) * 100}%`,
                    backgroundColor:
                      cb.clonesLastHour >= 40
                        ? "#ef4444"
                        : cb.clonesLastHour >= 30
                        ? "#eab308"
                        : "#22c55e",
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Rate Graph */}
      <Card className="glass-panel card-gold-hover mt-6 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
            <AlertTriangle className="h-4 w-4 text-[#d4af37]" />
            Hourly Clone Rate (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyRateData}>
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
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {hourlyRateData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.rate >= 40
                        ? "#ef4444"
                        : entry.rate >= 30
                        ? "#eab308"
                        : "#d4af37"
                    }
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </AppShell>
  );
}
