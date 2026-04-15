"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ChainBadge } from "@/components/chain-badge";
import {
  generateDeployments,
  shortenAddress,
  formatCurrency,
} from "@/lib/mock-data";
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
import { Rocket, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { StatCard } from "@/components/stat-card";

const ALL_DEPLOYMENTS = generateDeployments(40);

export default function DeploymentsPage() {
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return ALL_DEPLOYMENTS.filter((d) => {
      if (chainFilter !== "all" && d.chain !== chainFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [chainFilter, statusFilter]);

  const successCount = ALL_DEPLOYMENTS.filter(
    (d) => d.status === "success"
  ).length;
  const totalPnl = ALL_DEPLOYMENTS.filter((d) => d.status === "success").reduce(
    (s, d) => s + d.pnl,
    0
  );
  const avgPnl =
    successCount > 0 ? totalPnl / successCount : 0;

  return (
    <AppShell
      title="Deployment History"
      description="Clone deployment history and performance tracking"
    >
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Deployments"
          value={ALL_DEPLOYMENTS.length}
          sublabel={`${successCount} successful`}
          trend="up"
          icon={<Rocket className="h-5 w-5" />}
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(totalPnl)}
          sublabel={
            totalPnl >= 0 ? "Profitable" : "Net negative"
          }
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
          sublabel={`across ${successCount} deployments`}
          trend={avgPnl >= 0 ? "up" : "down"}
          icon={<Minus className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <Card className="glass-panel card-gold-hover mb-6 border-0">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
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
          <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v); }}>
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
            {filtered.length} deployments
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
              {filtered.map((dep) => (
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
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-0 text-xs ${
                        dep.status === "success"
                          ? "bg-[#22c55e]/10 text-[#22c55e]"
                          : dep.status === "failed"
                          ? "bg-[#ef4444]/10 text-[#ef4444]"
                          : "bg-[#eab308]/10 text-[#eab308]"
                      }`}
                    >
                      {dep.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`font-mono text-sm ${
                      dep.pnl > 0
                        ? "text-[#22c55e]"
                        : dep.pnl < 0
                        ? "text-[#ef4444]"
                        : "text-[#888]"
                    }`}
                  >
                    {dep.pnl > 0 ? "+" : ""}
                    {dep.pnl.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[#666]">
                    {shortenAddress(dep.txHash)}
                  </TableCell>
                  <TableCell className="text-xs text-[#666]">
                    {new Date(dep.deployedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
