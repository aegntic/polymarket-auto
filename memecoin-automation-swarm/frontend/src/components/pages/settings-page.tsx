"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { getModules, type ModuleStatus } from "@/lib/api-collector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Link, Cpu, Eye, EyeOff, Server } from "lucide-react";

interface ChainConfig {
  name: string;
  rpcUrl: string;
  enabled: boolean;
}

const INITIAL_CHAINS: ChainConfig[] = [
  { name: "Solana", rpcUrl: "https://api.mainnet-beta.solana.com", enabled: true },
  { name: "Base", rpcUrl: "https://mainnet.base.org", enabled: true },
  { name: "BNB", rpcUrl: "https://bsc-dataseed.binance.org", enabled: true },
];

interface ServerConfigKey {
  name: string;
  envVar: string;
}

const SERVER_CONFIG_KEYS: ServerConfigKey[] = [
  { name: "NVIDIA API Key", envVar: "NVIDIA_API_KEY" },
  { name: "Redis URL", envVar: "REDIS_URL" },
  { name: "ClickHouse URL", envVar: "CLICKHOUSE_URL" },
];

export default function SettingsPage() {
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [chains, setChains] = useState<ChainConfig[]>(INITIAL_CHAINS);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    getModules()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setModules(res.data);
          setModulesError(null);
        } else {
          setModulesError(res.error ?? "Failed to load modules");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setModulesError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setModulesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleModule = (id: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      )
    );
  };

  const toggleChain = (name: string) => {
    setChains((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, enabled: !c.enabled } : c
      )
    );
  };

  const toggleKeyVisibility = (name: string) => {
    setVisibleKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  if (modulesLoading) {
    return (
      <AppShell title="Settings" description="Loading...">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" description="Chain configs, API keys, and module toggles">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Module Toggles */}
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
              <Cpu className="h-4 w-4 text-[#d4af37]" />
              Module Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {modulesError && (
              <div className="rounded-lg bg-[#ef4444]/10 p-3 mb-3">
                <p className="text-xs text-[#ef4444]">
                  Failed to load modules: {modulesError}
                </p>
              </div>
            )}
            {modules.length === 0 && !modulesError && (
              <div className="rounded-lg bg-[rgba(255,255,255,0.02)] p-3">
                <p className="text-xs text-[#888]">
                  No modules found. Start the backend to populate module data.
                </p>
              </div>
            )}
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
              >
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor={`mod-${mod.id}`}
                    className="cursor-pointer font-semibold tracking-wider text-[#f5f5f5]"
                  >
                    {mod.name}
                  </Label>
                  <Badge
                    variant="outline"
                    className={`border-0 text-[10px] ${
                      mod.status === "running"
                        ? "bg-[#22c55e]/10 text-[#22c55e]"
                        : mod.status === "error"
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : "bg-[#888]/10 text-[#888]"
                    }`}
                  >
                    {mod.status}
                  </Badge>
                </div>
                <Switch
                  id={`mod-${mod.id}`}
                  checked={mod.enabled}
                  onCheckedChange={() => toggleModule(mod.id)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Chain Configuration */}
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
              <Link className="h-4 w-4 text-[#d4af37]" />
              Chain Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {chains.map((chain) => (
              <div key={chain.name}>
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-[#f5f5f5]">
                    {chain.name}
                  </Label>
                  <Switch
                    checked={chain.enabled}
                    onCheckedChange={() => toggleChain(chain.name)}
                  />
                </div>
                <Input
                  value={chain.rpcUrl}
                  disabled={!chain.enabled}
                  onChange={(e) =>
                    setChains((prev) =>
                      prev.map((c) =>
                        c.name === chain.name
                          ? { ...c, rpcUrl: e.target.value }
                          : c
                      )
                    )
                  }
                  className="mt-2 border-[rgba(212,175,55,0.12)] bg-[rgba(255,255,255,0.03)] font-mono text-xs text-[#f5f5f5] disabled:opacity-40"
                />
                <Separator className="mt-4 bg-[rgba(212,175,55,0.06)]" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Server Configuration */}
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
              <Server className="h-4 w-4 text-[#d4af37]" />
              Server Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-[#666] mb-2">
              These environment variables are configured server-side. Values cannot be read from the client.
            </p>
            {SERVER_CONFIG_KEYS.map((configKey) => (
              <div
                key={configKey.envVar}
                className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.02)] p-3"
              >
                <Key className="h-4 w-4 shrink-0 text-[#666]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#f5f5f5]">
                    {configKey.name}
                  </p>
                  <p className="font-mono text-xs text-[#888]">
                    {visibleKeys[configKey.envVar] ? configKey.envVar : "••••••••••••••••"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-0 text-[10px] bg-[#d4af37]/10 text-[#d4af37]"
                >
                  server-side
                </Badge>
                <button
                  onClick={() => toggleKeyVisibility(configKey.envVar)}
                  className="rounded p-1.5 text-[#666] transition-colors hover:text-[#d4af37]"
                >
                  {visibleKeys[configKey.envVar] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
