"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ConfidenceGauge } from "@/components/confidence-gauge";
import {
  generateClassification,
  type Chain,
  type ClassificationResult,
} from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ClassifyPage() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<Chain>("solana");
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClassify = async () => {
    if (!address.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    const r = generateClassification(address, chain);
    setResult(r);
    setLoading(false);
  };

  return (
    <AppShell title="Classify" description="Token clone classifier — enter a token address to analyze">
      <div className="mx-auto max-w-3xl">
        {/* Input Form */}
        <Card className="glass-panel card-gold-hover mb-6 border-0">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Input
                  placeholder="Enter token address (e.g., 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] font-mono text-sm text-[#f5f5f5] placeholder:text-[#555]"
                  onKeyDown={(e) => e.key === "Enter" && handleClassify()}
                />
              </div>
              <Select
                value={chain}
                onValueChange={(v) => { if (v !== null) setChain(v as Chain); }}
              >
                <SelectTrigger className="w-[130px] border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
                  <SelectItem value="solana">Solana</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="bnb">BNB</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleClassify}
                disabled={loading || !address.trim()}
                className="bg-[#d4af37] text-[#0a0a0a] hover:bg-[#f0d89a] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Classify
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="glass-panel card-gold-hover border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      {result.isClone ? (
                        <AlertTriangle className="h-6 w-6 text-[#ef4444]" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6 text-[#22c55e]" />
                      )}
                      {result.isClone ? "Clone Detected" : "Not a Clone"}
                    </CardTitle>
                    <Badge
                      className={`border-0 ${
                        result.riskLevel === "high"
                          ? "bg-[#ef4444]/10 text-[#ef4444]"
                          : result.riskLevel === "medium"
                          ? "bg-[#eab308]/10 text-[#eab308]"
                          : "bg-[#22c55e]/10 text-[#22c55e]"
                      }`}
                    >
                      {result.riskLevel.toUpperCase()} RISK
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="flex flex-col items-center justify-center">
                      <ConfidenceGauge value={result.confidence} />
                    </div>

                    <div className="col-span-1 space-y-4 md:col-span-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-[#888]">Chain</span>
                          <p className="font-medium text-[#f5f5f5] capitalize">
                            {result.chain}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#888]">Similarity</span>
                          <p className="font-medium text-[#f5f5f5]">
                            {(result.similarityScore * 100).toFixed(1)}%
                          </p>
                        </div>
                        {result.originalToken && (
                          <div className="col-span-2">
                            <span className="text-[#888]">
                              Suspected Original
                            </span>
                            <p className="font-medium text-[#d4af37]">
                              {result.originalToken}
                            </p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-[#888]">Strategy</span>
                          <p className="font-medium text-[#f5f5f5]">
                            {result.strategy}
                          </p>
                        </div>
                      </div>

                      <Separator className="bg-[rgba(212,175,55,0.08)]" />

                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#888]">
                          Reasoning
                        </p>
                        <ul className="space-y-1.5">
                          {result.reasoning.map((r, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-[#ccc]"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4af37]" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#666]">
            <Search className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg">Enter a token address to classify</p>
            <p className="mt-1 text-sm">
              Supports Solana, Base, and BNB chains
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
