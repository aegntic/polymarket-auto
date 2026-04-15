"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { generateModules, type ModuleStatus } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Link, Cpu, Eye, EyeOff } from "lucide-react";

const INITIAL_MODULES = generateModules();

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

interface ApiKey {
  name: string;
  key: string;
  masked: string;
}

const INITIAL_KEYS: ApiKey[] = [
  { name: "OpenRouter API Key", key: "sk-or-v1-xxxxx", masked: "sk-or-v1-••••••••••••" },
  { name: "Helius RPC Key", key: "helius-xxxxx", masked: "helius-•••••••••" },
  { name: "Anthropic API Key", key: "sk-ant-xxxxx", masked: "sk-ant-••••••••••••" },
];

export default function SettingsPage() {
  const [modules, setModules] = useState<ModuleStatus[]>(INITIAL_MODULES);
  const [chains, setChains] = useState<ChainConfig[]>(INITIAL_CHAINS);
  const [keys] = useState<ApiKey[]>(INITIAL_KEYS);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

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

        {/* API Keys */}
        <Card className="glass-panel card-gold-hover border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#888]">
              <Key className="h-4 w-4 text-[#d4af37]" />
              API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {keys.map((apiKey) => (
              <div
                key={apiKey.name}
                className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.02)] p-3"
              >
                <Key className="h-4 w-4 shrink-0 text-[#666]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#f5f5f5]">
                    {apiKey.name}
                  </p>
                  <p className="font-mono text-xs text-[#888]">
                    {visibleKeys[apiKey.name] ? apiKey.key : apiKey.masked}
                  </p>
                </div>
                <button
                  onClick={() => toggleKeyVisibility(apiKey.name)}
                  className="rounded p-1.5 text-[#666] transition-colors hover:text-[#d4af37]"
                >
                  {visibleKeys[apiKey.name] ? (
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
