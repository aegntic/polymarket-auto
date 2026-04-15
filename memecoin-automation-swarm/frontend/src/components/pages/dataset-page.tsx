"use client";

import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ChainBadge } from "@/components/chain-badge";
import { generateDataset } from "@/lib/mock-data";
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
import { Database, Download, Filter } from "lucide-react";
import { StatCard } from "@/components/stat-card";

const ALL_DATA = generateDataset(100);

export default function DatasetPage() {
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [cloneFilter, setCloneFilter] = useState<string>("all");
  const [format, setFormat] = useState<"jsonl" | "csv">("jsonl");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const filtered = useMemo(() => {
    return ALL_DATA.filter((d) => {
      if (chainFilter !== "all" && d.chain !== chainFilter) return false;
      if (cloneFilter === "clone" && !d.isClone) return false;
      if (cloneFilter === "original" && d.isClone) return false;
      return true;
    });
  }, [chainFilter, cloneFilter]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const cloneCount = filtered.filter((d) => d.isClone).length;
  const originalCount = filtered.length - cloneCount;

  const handleExport = () => {
    const rows = filtered.map((d) => ({
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
          value={filtered.length}
          sublabel="in current view"
          icon={<Database className="h-5 w-5" />}
        />
        <StatCard
          label="Clones"
          value={cloneCount}
          sublabel={`${((cloneCount / filtered.length) * 100).toFixed(1)}% of total`}
          trend="neutral"
          icon={<Filter className="h-5 w-5" />}
        />
        <StatCard
          label="Originals"
          value={originalCount}
          sublabel={`${((originalCount / filtered.length) * 100).toFixed(1)}% of total`}
          trend="neutral"
          icon={<Database className="h-5 w-5" />}
        />
      </div>

      {/* Filters + Export */}
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
          <Select value={cloneFilter} onValueChange={(v) => { if (v !== null) setCloneFilter(v); }}>
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
              onValueChange={(v) => { if (v !== null) setFormat(v as "jsonl" | "csv"); }}
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
                    {row.isClone ? `${(row.similarity * 100).toFixed(0)}%` : "\u2014"}
                  </TableCell>
                  <TableCell className="text-xs text-[#666]">
                    {new Date(row.classifiedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-[#888]">
        <span>
          Page {page + 1} of {totalPages} ({filtered.length} records)
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
    </AppShell>
  );
}
