"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ChainBadge } from "@/components/chain-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Rocket, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { getDeployments, type Deployment } from "@/lib/api-collector";

// ---------------------------------------------------------------------------
// Local utilities (replacing mock-data helpers)
// ---------------------------------------------------------------------------

function shortenAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "auto",
  }).format(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch real deployments on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchDeployments() {
      setLoading(true);
      setError(null);

      const res = await getDeployments();

      if (cancelled) return;

      if (res.success && res.data) {
        setDeployments(res.data);
      } else {
        setError(res.error ?? "Failed to load deployments");
        setDeployments([]);
      }

      setLoading(false);
    }

    fetchDeployments();

    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filtering
  const filtered = useMemo(() => {
    return deployments.filter((d) => {
      if (chainFilter !== "all" && d.chain !== chainFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [deployments, chainFilter, statusFilter]);

  // Computed stats derived from real data
  const successDeployments = useMemo(
    () => deployments.filter((d) => d.status === "success"),
    [deployments],
  );

  const totalPnl = useMemo(
    () => successDeployments.reduce((sum, d) => sum + d.pnl, 0),
    [successDeployments],
  );

  const avgPnl = useMemo(
    () => (successDeployments.length > 0 ? totalPnl / successDeployments.length : 0),
    [successDeployments, totalPnl],
  );

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  function renderPnl(pnl: number) {
    return (
      <span
        className={`font-mono text-sm ${
          pnl > 0
            ? "text-[#22c55e]"
            : pnl < 0
              ? "text-[#ef4444]"
              : "text-[#888]"
        }`}
      >
        {pnl > 0 ? "+" : ""}
        {pnl.toFixed(2)}
      </span>
    );
  }

  function renderStatusBadge(status: Deployment["status"]) {
    return (
      <Badge
        variant="outline"
        className={`border-0 text-xs ${
          status === "success"
            ? "bg-[#22c55e]/10 text-[#22c55e]"
            : status === "failed"
              ? "bg-[#ef4444]/10 text-[#ef4444]"
              : "bg-[#eab308]/10 text-[#eab308]"
        }`}
      >
        {status}
      </Badge>
    );
  }

  function renderFormattedTime(isoString: string) {
    return (
      <span className="text-xs text-[#666]">
        {new Date(isoString).toISOString().replace("T", " ").slice(0, 19)}
      </span>
    );
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <AppShell
        title="Deployment History"
        description="Clone deployment history and performance tracking"
      >
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#888]">
          <Loader2 className="h-8 w-8 animate-spin text-[#d4af37]" />
          <p className="text-sm">Loading deployments...</p>
        </div>
      </AppShell>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <AppShell
        title="Deployment History"
        description="Clone deployment history and performance tracking"
      >
        <Card className="glass-panel border-0">
          <CardContent className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-sm text-[#ef4444]">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-[rgba(212,175,55,0.12)] px-4 py-2 text-xs font-medium text-[#d4af37] transition-colors hover:bg-[rgba(212,175,55,0.2)]"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // -----------------------------------------------------------------------
  // Main content
  // -----------------------------------------------------------------------

  return (
    <AppShell
      title="Deployment History"
      description="Clone deployment history and performance tracking"
    >
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Deployments"
          value={deployments.length}
          sublabel={`${successDeployments.length} successful`}
          trend="up"
          icon={<Rocket className="h-5 w-5" />}
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(totalPnl)}
          sublabel={totalPnl >= 0 ? "Profitable" : "Net negative"}
          trend={totalPnl >= 0 ? "up" : "down"}
          icon={
            totalPnl >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
        />
        <StatCard
          label="Avg P&L per Deploy"
          value={formatCurrency(avgPnl)}
          sublabel={`across ${successDeployments.length} deployments`}
          trend={avgPnl >= 0 ? "up" : "down"}
          icon={<Minus className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <Card className="glass-panel card-gold-hover mb-6 border-0">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <Select
            value={chainFilter}
            onValueChange={(v) => {
              if (v !== null) setChainFilter(v);
            }}
          >
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
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              if (v !== null) setStatusFilter(v);
            }}
          >
            <SelectTrigger className="w-[140px] border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-[#888]">
            {filtered.length} deployment{filtered.length !== 1 ? "s" : ""}
          </span>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-panel card-gold-hover border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(212,175,55,0.08)] hover:bg-transparent">
                <TableHead className="text-[#888]">Token</TableHead>
                <TableHead className="text-[#888]">Chain</TableHead>
                <TableHead className="text-[#888]">Strategy</TableHead>
                <TableHead className="text-[#888]">Status</TableHead>
                <TableHead className="text-[#888]">P&L</TableHead>
                <TableHead className="text-[#888]">TX Hash</TableHead>
                <TableHead className="text-[#888]">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-[#666]"
                  >
                    No deployments match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((dep) => (
                  <TableRow
                    key={dep.id}
                    className="border-[rgba(212,175,55,0.05)] hover:bg-[rgba(212,175,55,0.03)]"
                  >
                    <TableCell className="font-medium text-[#f5f5f5]">
                      {dep.tokenName}
                    </TableCell>
                    <TableCell>
                      <ChainBadge chain={dep.chain} />
                    </TableCell>
                    <TableCell className="text-sm text-[#888]">
                      {dep.strategy}
                    </TableCell>
                    <TableCell>{renderStatusBadge(dep.status)}</TableCell>
                    <TableCell>{renderPnl(dep.pnl)}</TableCell>
                    <TableCell className="font-mono text-xs text-[#666]">
                      {shortenAddress(dep.txHash)}
                    </TableCell>
                    <TableCell>{renderFormattedTime(dep.deployedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
