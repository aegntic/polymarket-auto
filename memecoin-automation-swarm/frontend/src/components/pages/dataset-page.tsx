"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ChainBadge } from "@/components/chain-badge";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Database, Download, Filter, Loader2 } from "lucide-react";
import { getDataset } from "@/lib/api-collector";
import type { Chain, DatasetRow } from "@/lib/api-collector";

const PAGE_SIZE = 20;

export default function DatasetPage() {
  const [data, setData] = useState<DatasetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [cloneFilter, setCloneFilter] = useState<string>("all");
  const [format, setFormat] = useState<"jsonl" | "csv">("jsonl");
  const [page, setPage] = useState(0);

  const fetchDataset = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: {
      chain?: Chain;
      isClone?: boolean;
      page?: number;
      pageSize?: number;
    } = { page: 0, pageSize: 10000 };

    if (chainFilter !== "all") {
      params.chain = chainFilter as Chain;
    }
    if (cloneFilter === "clone") {
      params.isClone = true;
    } else if (cloneFilter === "original") {
      params.isClone = false;
    }

    const response = await getDataset(params);

    if (response.success && response.data) {
      setData(response.data);
    } else {
      setError(response.error ?? "Failed to load dataset");
      setData([]);
    }

    setLoading(false);
  }, [chainFilter, cloneFilter]);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [chainFilter, cloneFilter]);

  const paged = useMemo(
    () => data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [data, page],
  );
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));

  const cloneCount = useMemo(() => data.filter((d) => d.isClone).length, [data]);
  const originalCount = data.length - cloneCount;

  const safePercent = (count: number, total: number): string => {
    if (total === 0) return "0.0%";
    return `${((count / total) * 100).toFixed(1)}%`;
  };

  const handleExport = () => {
    if (data.length === 0) return;

    const rows = data.map((d) => ({
      id: d.id,
      address: d.address,
      chain: d.chain,
      isClone: d.isClone,
      confidence: d.confidence,
      originalToken: d.originalToken,
      similarity: d.similarity,
      classifiedAt: d.classifiedAt,
    }));

    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === "jsonl") {
      content = rows.map((r) => JSON.stringify(r)).join("\n");
      mimeType = "application/jsonl";
      ext = "jsonl";
    } else {
      const headers = Object.keys(rows[0]).join(",");
      const csvRows = rows.map((r) => Object.values(r).join(","));
      content = [headers, ...csvRows].join("\n");
      mimeType = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mas-dataset.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Dataset"
      description="CloneNet dataset browser and export"
    >
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Records"
          value={loading ? "\u2014" : data.length}
          sublabel={error ? "Error loading data" : "in current view"}
          icon={<Database className="h-5 w-5" />}
        />
        <StatCard
          label="Clones"
          value={loading ? "\u2014" : cloneCount}
          sublabel={`${safePercent(cloneCount, data.length)} of total`}
          trend="neutral"
          icon={<Filter className="h-5 w-5" />}
        />
        <StatCard
          label="Originals"
          value={loading ? "\u2014" : originalCount}
          sublabel={`${safePercent(originalCount, data.length)} of total`}
          trend="neutral"
          icon={<Database className="h-5 w-5" />}
        />
      </div>

      {/* Filters + Export */}
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
            value={cloneFilter}
            onValueChange={(v) => {
              if (v !== null) setCloneFilter(v);
            }}
          >
            <SelectTrigger className="w-[140px] border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="clone">Clones Only</SelectItem>
              <SelectItem value="original">Originals Only</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Select
              value={format}
              onValueChange={(v) => {
                if (v !== null) setFormat(v as "jsonl" | "csv");
              }}
            >
              <SelectTrigger className="w-[100px] border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] text-sm text-[#f5f5f5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[rgba(212,175,55,0.15)] bg-[#1a1a1a]">
                <SelectItem value="jsonl">JSONL</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleExport}
              disabled={loading || data.length === 0}
              className="bg-[#d4af37] text-[#0a0a0a] hover:bg-[#f0d89a]"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-panel card-gold-hover border-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-[#888]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading dataset...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#888]">
              <span className="text-sm text-[#ef4444]">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDataset}
                className="mt-2 border-[rgba(212,175,55,0.12)] text-[#888] hover:text-[#d4af37]"
              >
                Retry
              </Button>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-[#888]">
              No records found for the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[rgba(212,175,55,0.08)] hover:bg-transparent">
                  <TableHead className="text-[#888]">Address</TableHead>
                  <TableHead className="text-[#888]">Chain</TableHead>
                  <TableHead className="text-[#888]">Clone?</TableHead>
                  <TableHead className="text-[#888]">Confidence</TableHead>
                  <TableHead className="text-[#888]">Original</TableHead>
                  <TableHead className="text-[#888]">Similarity</TableHead>
                  <TableHead className="text-[#888]">Classified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-[rgba(212,175,55,0.05)] hover:bg-[rgba(212,175,55,0.03)]"
                  >
                    <TableCell className="max-w-[160px] truncate font-mono text-xs text-[#f5f5f5]">
                      {row.address}
                    </TableCell>
                    <TableCell>
                      <ChainBadge chain={row.chain} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-0 text-xs ${
                          row.isClone
                            ? "bg-[#ef4444]/10 text-[#ef4444]"
                            : "bg-[#22c55e]/10 text-[#22c55e]"
                        }`}
                      >
                        {row.isClone ? "CLONE" : "ORIG"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[#f5f5f5]">
                      {(row.confidence * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-sm text-[#888]">
                      {row.originalToken}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[#f5f5f5]">
                      {row.isClone
                        ? `${(row.similarity * 100).toFixed(0)}%`
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-xs text-[#666]">
                      {new Date(row.classifiedAt).toISOString().slice(0, 10)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && data.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[#888]">
          <span>
            Page {page + 1} of {totalPages} ({data.length} records)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="border-[rgba(212,175,55,0.12)] text-[#888] hover:text-[#d4af37]"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="border-[rgba(212,175,55,0.12)] text-[#888] hover:text-[#d4af37]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
