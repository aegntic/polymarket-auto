"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { ChainBadge } from "@/components/chain-badge";
import { Sparkline } from "@/components/sparkline";
import { getSignals, type TokenSignal, type Chain } from "@/lib/api-collector";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radio, Filter, Search, Loader2 } from "lucide-react";

// --- Local formatters (previously from mock-data) ---

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function shortenAddress(address: string | undefined | null): string {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// --- Component ---

export default function SignalsPage() {
  const [signals, setSignals] = useState<TokenSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSignals({ limit: 50 });
      if (res.success && res.data) {
        setSignals(res.data);
      } else {
        setError(res.error ?? "Failed to load signals");
        setSignals([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (chainFilter !== "all" && s.chain !== chainFilter) return false;
      if (scoreFilter === "high" && s.score < 0.8) return false;
      if (scoreFilter === "medium" && (s.score < 0.5 || s.score >= 0.8))
        return false;
      if (scoreFilter === "low" && s.score >= 0.5) return false;
      if (
        searchQuery &&
        !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [signals, chainFilter, scoreFilter, searchQuery]);

  return (
    <AppShell title="Signals" description="Real-time token signal feed from RECON module">
      {/* Filters */}
      <Card className="glass-panel card-gold-hover mb-6 border-0">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2 text-sm text-[#888]">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
            <Input
              placeholder="Search name, symbol, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] pl-9 text-sm text-[#f5f5f5] placeholder:text-[#555]"
            />
          </div>
          <Select value={chainFilter} onValueChange={(v) => { if (v !== null) setChainFilter(v); }}>
            <SelectTrigger className="w-[140px] border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
              <SelectItem value="all">All Chains</SelectItem>
              <SelectItem value="solana">Solana</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="bnb">BNB</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={(v) => { if (v !== null) setScoreFilter(v); }}>
            <SelectTrigger className="w-[140px] border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="high">High (0.8+)</SelectItem>
              <SelectItem value="medium">Medium (0.5-0.8)</SelectItem>
              <SelectItem value="low">Low (&lt;0.5)</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-[#888]">
            {filtered.length} signals
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-[#888]">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#d4af37]" />
          <p className="text-lg">Loading signals...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 text-[#ef4444]">
          <Radio className="mb-4 h-12 w-12 opacity-40" />
          <p className="text-lg">Failed to load signals</p>
          <p className="mt-1 text-sm text-[#666]">{error}</p>
        </div>
      )}

      {/* Signal Cards Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((signal, i) => (
            <Card
              key={signal.id}
              className="glass-panel card-gold-hover border-0 transition-all duration-200 hover:scale-[1.01]"
            >
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ChainBadge chain={signal.chain} />
                    <div>
                      <p className="font-semibold text-[#f5f5f5]">
                        {signal.name}
                      </p>
                      <p className="text-xs text-[#666]">
                        {shortenAddress(signal.address)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`border-0 text-xs font-bold ${
                      signal.score >= 0.8
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : signal.score >= 0.5
                        ? "bg-[#eab308]/10 text-[#eab308]"
                        : "bg-[#22c55e]/10 text-[#22c55e]"
                    }`}
                  >
                    {signal.score.toFixed(2)}
                  </Badge>
                </div>

                <div className="mb-3 flex items-end justify-between">
                  <Sparkline seed={i + 100} width={120} height={32} />
                  <div className="text-right text-xs text-[#888]">
                    <p>Vol: {formatCurrency(signal.volume24h)}</p>
                    <p>MCap: {formatCurrency(signal.marketCap)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#666]">
                  <span>Age: {signal.age}</span>
                  <span>
                    {new Date(signal.detectedAt).toISOString().slice(11, 19)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[#666]">
          <Radio className="mb-4 h-12 w-12 opacity-30" />
          <p className="text-lg">No signals found</p>
          {signals.length > 0 && (
            <p className="mt-1 text-sm">Try adjusting your filters</p>
          )}
        </div>
      )}
    </AppShell>
  );
}
