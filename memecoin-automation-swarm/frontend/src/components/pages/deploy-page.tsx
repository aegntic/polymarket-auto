"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ChainBadge } from "@/components/chain-badge";
import type { Chain } from "@/lib/types";
import {
  getSignals,
  getCircuitBreaker,
  deployToken,
  type TokenSignal,
  type CircuitBreakerState,
} from "@/lib/api-collector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crosshair,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StatCard } from "@/components/stat-card";

const STRATEGIES = [
  {
    id: "substitution",
    name: "Substitution",
    description: "Replace a character with a visually similar one (e.g., l -> I)",
    risk: "low" as const,
  },
  {
    id: "homophone",
    name: "Homophone",
    description: "Use a phonetically similar name (e.g., Pepe -> Pepo)",
    risk: "low" as const,
  },
  {
    id: "suffix",
    name: "Suffix",
    description: "Append a common crypto suffix (e.g., Inu, Coin, Moon)",
    risk: "medium" as const,
  },
  {
    id: "unicode",
    name: "Unicode Spoof",
    description: "Use Unicode confusables for near-identical visual match",
    risk: "high" as const,
  },
];

type DeployStep = "select" | "configure" | "deploying" | "result";

interface DeployResult {
  success: boolean;
  tokenName: string;
  txHash: string;
  chain: Chain;
  strategy: string;
}

export default function DeployPage() {
  const [step, setStep] = useState<DeployStep>("select");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [strategy, setStrategy] = useState<string>("");
  const [chain, setChain] = useState<Chain>("solana");
  const [customName, setCustomName] = useState<string>("");
  const [result, setResult] = useState<DeployResult | null>(null);

  const [signals, setSignals] = useState<TokenSignal[]>([]);
  const [cb, setCb] = useState<CircuitBreakerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      const [signalsRes, cbRes] = await Promise.all([
        getSignals({ limit: 20 }),
        getCircuitBreaker(),
      ]);
      if (signalsRes.success && signalsRes.data) {
        setSignals(signalsRes.data);
      }
      if (cbRes.success && cbRes.data) {
        setCb(cbRes.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const canDeploy = cb ? cb.level !== "red" && cb.clonesToday < cb.maxPerDay : true;

  const selectedSignal = signals.find((s) => s.id === selectedToken);

  const filteredSignals = filter
    ? signals.filter(
        (s) =>
          s.name.toLowerCase().includes(filter.toLowerCase()) ||
          s.address.toLowerCase().includes(filter.toLowerCase()),
      )
    : signals;

  const handleDeploy = async () => {
    setStep("deploying");
    try {
      const res = await deployToken({
        name: customName || selectedSignal?.name || "Unknown",
        chain,
        strategy,
      });
      if (res.success && res.data) {
        setResult({
          success: res.data.status !== "failed",
          tokenName: res.data.tokenName,
          txHash: res.data.txHash,
          chain: res.data.chain,
          strategy: res.data.strategy,
        });
      } else {
        setResult({
          success: false,
          tokenName: customName || selectedSignal?.name || "Unknown",
          txHash: "",
          chain,
          strategy,
        });
      }
    } catch {
      setResult({
        success: false,
        tokenName: customName || selectedSignal?.name || "Unknown",
        txHash: "",
        chain,
        strategy,
      });
    }
    setStep("result");
  };

  const handleReset = () => {
    setStep("select");
    setSelectedToken("");
    setStrategy("");
    setCustomName("");
    setResult(null);
  };

  if (loading) {
    return (
      <AppShell title="Deploy" description="Clone token deployment manager">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Deploy" description="Clone token deployment manager">
      {/* Status cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Circuit Breaker"
          value={cb ? cb.level.toUpperCase() : "N/A"}
          sublabel={
            cb
              ? cb.level === "red"
                ? "Deployment halted"
                : "Deployments allowed"
              : "Loading..."
          }
          trend={
            cb
              ? cb.level === "green"
                ? "up"
                : cb.level === "red"
                  ? "down"
                  : "neutral"
              : "neutral"
          }
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <StatCard
          label="Daily Quota"
          value={cb ? `${cb.clonesToday}/${cb.maxPerDay}` : "N/A"}
          sublabel={
            cb ? `${cb.maxPerDay - cb.clonesToday} remaining today` : "Loading..."
          }
          trend={cb ? (cb.clonesToday > 40 ? "down" : "neutral") : "neutral"}
          icon={<Rocket className="h-5 w-5" />}
        />
        <StatCard
          label="LLM Budget"
          value={cb ? `$${cb.llmCostToday.toFixed(2)}` : "N/A"}
          sublabel={
            cb
              ? `of $${cb.llmBudgetPerDay.toFixed(2)} daily budget`
              : "Loading..."
          }
          trend={cb ? (cb.llmCostToday > 8 ? "down" : "neutral") : "neutral"}
          icon={<Crosshair className="h-5 w-5" />}
        />
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select Token */}
        {step === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-panel card-gold-hover border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
                  <Crosshair className="h-4 w-4 text-[#d4af37]" />
                  Select Target Token
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Filter tokens by name or address..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5] placeholder:text-[#555]"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {filteredSignals.slice(0, 10).map((signal) => (
                    <button
                      key={signal.id}
                      onClick={() => setSelectedToken(signal.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                        selectedToken === signal.id
                          ? "border-[#d4af37] bg-[rgba(212,175,55,0.08)]"
                          : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(212,175,55,0.2)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ChainBadge chain={signal.chain} />
                        <div>
                          <p className="text-sm font-medium text-[#f5f5f5]">
                            {signal.name}
                          </p>
                          <p className="text-xs text-[#666]">
                            Score: {signal.score.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`border-0 text-xs ${
                          signal.score >= 0.8
                            ? "bg-[#ef4444]/10 text-[#ef4444]"
                            : signal.score >= 0.5
                              ? "bg-[#eab308]/10 text-[#eab308]"
                              : "bg-[#22c55e]/10 text-[#22c55e]"
                        }`}
                      >
                        {signal.score.toFixed(2)}
                      </Badge>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={!selectedToken}
                    onClick={() => setStep("configure")}
                    className="bg-[#d4af37] text-[#0a0a0a] hover:bg-[#f0d89a] disabled:opacity-50"
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Configure Deployment */}
        {step === "configure" && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-panel card-gold-hover border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
                  <Rocket className="h-4 w-4 text-[#d4af37]" />
                  Configure Deployment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected token summary */}
                {selectedSignal && (
                  <div className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.02)] p-4">
                    <ChainBadge chain={selectedSignal.chain} />
                    <div>
                      <p className="font-medium text-[#f5f5f5]">
                        {selectedSignal.name}
                      </p>
                      <p className="text-xs text-[#666]">
                        Clone Score: {selectedSignal.score.toFixed(2)} |{" "}
                        {selectedSignal.symbol}
                      </p>
                    </div>
                  </div>
                )}

                {/* Clone name */}
                <div className="space-y-2">
                  <Label className="text-sm text-[#888]">Clone Token Name</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={
                      selectedSignal
                        ? `e.g., ${selectedSignal.name.replace(/o/g, "0").replace(/l/g, "1")}`
                        : "Enter clone token name"
                    }
                    className="border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5] placeholder:text-[#555]"
                  />
                </div>

                {/* Chain selection */}
                <div className="space-y-2">
                  <Label className="text-sm text-[#888]">Target Chain</Label>
                  <Select
                    value={chain}
                    onValueChange={(v) => {
                      if (v !== null) setChain(v as Chain);
                    }}
                  >
                    <SelectTrigger className="w-full border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
                      <SelectItem value="solana">Solana</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="bnb">BNB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Strategy selection */}
                <div className="space-y-2">
                  <Label className="text-sm text-[#888]">Deployment Strategy</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {STRATEGIES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStrategy(s.id)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          strategy === s.id
                            ? "border-[#d4af37] bg-[rgba(212,175,55,0.08)]"
                            : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(212,175,55,0.2)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[#f5f5f5]">
                            {s.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={`border-0 text-[10px] ${
                              s.risk === "high"
                                ? "bg-[#ef4444]/10 text-[#ef4444]"
                                : s.risk === "medium"
                                  ? "bg-[#eab308]/10 text-[#eab308]"
                                  : "bg-[#22c55e]/10 text-[#22c55e]"
                            }`}
                          >
                            {s.risk.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[#888]">{s.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="bg-[rgba(212,175,55,0.08)]" />

                {/* Deploy button */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep("select")}
                    className="border-[rgba(212,175,55,0.12)] text-[#888] hover:text-[#d4af37]"
                  >
                    Back
                  </Button>
                  <Button
                    disabled={!strategy || !canDeploy}
                    onClick={handleDeploy}
                    className="bg-[#d4af37] text-[#0a0a0a] hover:bg-[#f0d89a] disabled:opacity-50"
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    Deploy Clone
                  </Button>
                </div>

                {!canDeploy && cb && (
                  <div className="flex items-center gap-2 rounded-lg bg-[#ef4444]/10 p-3 text-sm text-[#ef4444]">
                    <AlertTriangle className="h-4 w-4" />
                    {cb.level === "red"
                      ? "Circuit breaker is at RED — all deployments halted."
                      : "Daily clone limit reached. Wait until tomorrow."}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Deploying */}
        {step === "deploying" && (
          <motion.div
            key="deploying"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-panel card-gold-hover border-0">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#d4af37]" />
                <p className="text-lg font-medium text-[#f5f5f5]">
                  Deploying Clone...
                </p>
                <p className="mt-2 text-sm text-[#888]">
                  Minting token on {chain} via {strategy} strategy
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Result */}
        {step === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-panel card-gold-hover border-0">
              <CardContent className="py-8">
                <div className="flex flex-col items-center">
                  {result.success ? (
                    <CheckCircle2 className="mb-4 h-16 w-16 text-[#22c55e]" />
                  ) : (
                    <AlertTriangle className="mb-4 h-16 w-16 text-[#ef4444]" />
                  )}
                  <p className="text-xl font-semibold text-[#f5f5f5]">
                    {result.success
                      ? "Clone Deployed Successfully"
                      : "Deployment Failed"}
                  </p>
                  <p className="mt-2 text-sm text-[#888]">
                    {result.success
                      ? "Your clone token is now live on-chain."
                      : "The deployment transaction reverted. Check logs."}
                  </p>
                </div>

                {result.success && (
                  <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#888]">Token Name</span>
                      <p className="font-medium text-[#f5f5f5]">
                        {result.tokenName}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#888]">Chain</span>
                      <p className="font-medium text-[#f5f5f5] capitalize">
                        {result.chain}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#888]">Strategy</span>
                      <p className="font-medium text-[#f5f5f5]">
                        {result.strategy}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#888]">TX Hash</span>
                      <p className="font-mono text-xs text-[#d4af37]">
                        {result.txHash.slice(0, 16)}...
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="border-[rgba(212,175,55,0.12)] text-[#888] hover:text-[#d4af37]"
                  >
                    Deploy Another
                  </Button>
                  <Button
                    onClick={handleReset}
                    className="bg-[#d4af37] text-[#0a0a0a] hover:bg-[#f0d89a]"
                  >
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
