'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, ChevronDown, Monitor, Bell, Bot, Database, RotateCcw, Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useDashboardSettings } from '@/hooks/useDashboardSettings'
import { useDashboardStore } from '@/lib/store'
import type { DashboardSettings } from '@/hooks/useDashboardSettings'

interface SectionProps {
  title: string
  icon: React.ElementType
  defaultOpen?: boolean
  children: React.ReactNode
}

function SettingsSection({ title, icon: Icon, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[#1e293b]/40 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-[#1e293b]/20"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[#a855f7]/70" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
            {title}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#64748b] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-3">{children}</div>
      </div>
    </div>
  )
}

interface SettingRowProps {
  label: string
  children: React.ReactNode
}

function SettingRow({ label, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#1e293b]/25 py-2 last:border-0">
      <span className="text-[10px] text-[#64748b]">{label}</span>
      <div className="text-[11px] text-[#e2e8f0] font-mono">{children}</div>
    </div>
  )
}

interface SelectProps {
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}

function CyberSelect({ value, options, onChange }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded-md border border-[#1e293b] bg-[#0a0e17] px-2 py-0.5 font-mono text-[11px] text-[#e2e8f0] outline-none transition-colors focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/20 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface RangeSliderProps {
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  onChange: (value: number) => void
  color?: string
}

function RangeSlider({
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
  color = '#a855f7',
}: RangeSliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-[#1e293b] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0"
        style={
          {
            '--slider-color': color,
            background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
          } as React.CSSProperties
        }
      />
      <span className="w-10 text-right font-mono text-[11px] text-[#e2e8f0]">
        {displayValue}
      </span>
    </div>
  )
}

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  prefix?: string
  min?: number
  max?: number
  step?: number
}

function NumberInput({ value, onChange, prefix = '', min, max, step = 1 }: NumberInputProps) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#64748b]">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className={`h-7 w-24 rounded-md border border-[#1e293b] bg-[#0a0e17] font-mono text-[11px] text-[#e2e8f0] outline-none transition-colors focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/20 ${
          prefix ? 'pl-5 pr-2' : 'px-2'
        }`}
      />
    </div>
  )
}

function SaveIndicator({ show }: { show: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 transition-all duration-300 ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'
      }`}
    >
      <Check className="h-3 w-3 text-[#00ff41]" />
      <span className="text-[10px] font-mono text-[#00ff41]">Settings saved</span>
    </div>
  )
}

export function DashboardSettings() {
  const { settings, updateSettings, resetSettings, hydrated } = useDashboardSettings()
  const [saveIndicator, setSaveIndicator] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleChange = useCallback(
    (partial: Partial<DashboardSettings>) => {
      updateSettings(partial)
      setSaveIndicator(true)
      useDashboardStore.getState().addToast({
        type: 'success',
        title: 'Settings Updated',
        description: 'Dashboard configuration saved successfully',
        duration: 3000,
      })
    },
    [updateSettings]
  )

  // Auto-hide save indicator after 1.5s
  useEffect(() => {
    if (!saveIndicator) return
    const timer = setTimeout(() => setSaveIndicator(false), 1500)
    return () => clearTimeout(timer)
  }, [saveIndicator, settings])

  // Auto-hide reset confirm after 3s
  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmReset])

  const handleReset = useCallback(() => {
    if (confirmReset) {
      resetSettings()
      setConfirmReset(false)
      setSaveIndicator(true)
      useDashboardStore.getState().addToast({
        type: 'warning',
        title: 'Settings Reset',
        description: 'All settings have been restored to defaults',
      })
    } else {
      setConfirmReset(true)
    }
  }, [confirmReset, resetSettings])

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 p-6 backdrop-blur-sm card-accent-purple">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-[#1e293b]" />
          <div className="h-3 w-48 rounded bg-[#1e293b]/60" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm card-accent-purple">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b]/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#a855f7]/10">
            <Settings className="h-3.5 w-3.5 text-[#a855f7]" />
          </div>
          <div>
            <h3 className="card-title-cyber">DASHBOARD CONFIG</h3>
            <p className="text-[9px] text-[#64748b]">Customize your experience</p>
          </div>
        </div>
        <SaveIndicator show={saveIndicator} />
      </div>

      {/* Settings Sections */}
      <div className="max-h-[480px] overflow-y-auto">
        {/* A. Display Settings */}
        <SettingsSection title="Display" icon={Monitor} defaultOpen={true}>
          <SettingRow label="Matrix Rain Effect">
            <Switch
              checked={settings.matrixRain}
              onCheckedChange={(checked) => handleChange({ matrixRain: checked })}
              className="data-[state=checked]:bg-[#00ff41] data-[state=unchecked]:bg-[#1e293b]"
            />
          </SettingRow>
          <SettingRow label="Animation Speed">
            <RangeSlider
              value={settings.animationSpeed}
              min={0.5}
              max={2}
              step={0.1}
              displayValue={`${settings.animationSpeed.toFixed(1)}x`}
              onChange={(v) => handleChange({ animationSpeed: v })}
              color="#a855f7"
            />
          </SettingRow>
          <SettingRow label="Card Style">
            <CyberSelect
              value={settings.cardStyle}
              options={[
                { label: 'Glass', value: 'glass' },
                { label: 'Flat', value: 'flat' },
                { label: 'Neon Border', value: 'neon' },
              ]}
              onChange={(v) => handleChange({ cardStyle: v as DashboardSettings['cardStyle'] })}
            />
          </SettingRow>
          <SettingRow label="Compact Layout">
            <Switch
              checked={settings.compactMode}
              onCheckedChange={(checked) => handleChange({ compactMode: checked })}
              className="data-[state=checked]:bg-[#00ff41] data-[state=unchecked]:bg-[#1e293b]"
            />
          </SettingRow>
        </SettingsSection>

        {/* B. Notification Settings */}
        <SettingsSection title="Notifications" icon={Bell} defaultOpen={true}>
          <SettingRow label="Trade Alerts">
            <Switch
              checked={settings.tradeAlerts}
              onCheckedChange={(checked) => handleChange({ tradeAlerts: checked })}
              className="data-[state=checked]:bg-[#00ff41] data-[state=unchecked]:bg-[#1e293b]"
            />
          </SettingRow>
          <SettingRow label="Cluster Detection Alerts">
            <Switch
              checked={settings.clusterAlerts}
              onCheckedChange={(checked) => handleChange({ clusterAlerts: checked })}
              className="data-[state=checked]:bg-[#00ff41] data-[state=unchecked]:bg-[#1e293b]"
            />
          </SettingRow>
          <SettingRow label="Price Alert Threshold">
            <NumberInput
              value={settings.priceThreshold}
              onChange={(v) => handleChange({ priceThreshold: v })}
              prefix="$"
              min={1}
              step={5}
            />
          </SettingRow>
          <SettingRow label="Sentiment Threshold">
            <RangeSlider
              value={settings.sentimentThreshold}
              min={-1}
              max={1}
              step={0.05}
              displayValue={settings.sentimentThreshold.toFixed(2)}
              onChange={(v) => handleChange({ sentimentThreshold: v })}
              color="#f59e0b"
            />
          </SettingRow>
        </SettingsSection>

        {/* C. Agent Settings */}
        <SettingsSection title="Agent" icon={Bot} defaultOpen={true}>
          <SettingRow label="Autonomous Trading">
            <Switch
              checked={settings.autoTrade}
              onCheckedChange={(checked) => handleChange({ autoTrade: checked })}
              className="data-[state=checked]:bg-[#00ff41] data-[state=unchecked]:bg-[#1e293b]"
            />
          </SettingRow>
          <SettingRow label="Max Kelly Fraction">
            <RangeSlider
              value={settings.kellyFraction}
              min={0.1}
              max={1}
              step={0.05}
              displayValue={settings.kellyFraction.toFixed(2)}
              onChange={(v) => handleChange({ kellyFraction: v })}
              color="#22d3ee"
            />
          </SettingRow>
          <SettingRow label="Min Confidence">
            <RangeSlider
              value={settings.confidenceThreshold}
              min={0.5}
              max={0.99}
              step={0.01}
              displayValue={`${(settings.confidenceThreshold * 100).toFixed(0)}%`}
              onChange={(v) => handleChange({ confidenceThreshold: v })}
              color="#00ff41"
            />
          </SettingRow>
          <SettingRow label="Max Position Size">
            <NumberInput
              value={settings.maxPositionSize}
              onChange={(v) => handleChange({ maxPositionSize: v })}
              prefix="$"
              min={10}
              step={50}
            />
          </SettingRow>
        </SettingsSection>

        {/* D. Data Settings */}
        <SettingsSection title="Data" icon={Database} defaultOpen={false}>
          <SettingRow label="Refresh Interval">
            <CyberSelect
              value={String(settings.refreshInterval)}
              options={[
                { label: '5s', value: '5' },
                { label: '10s', value: '10' },
                { label: '15s', value: '15' },
                { label: '30s', value: '30' },
                { label: '60s', value: '60' },
              ]}
              onChange={(v) => handleChange({ refreshInterval: parseInt(v, 10) })}
            />
          </SettingRow>
          <SettingRow label="Time Range">
            <CyberSelect
              value={settings.timeRange}
              options={[
                { label: '1H', value: '1H' },
                { label: '4H', value: '4H' },
                { label: '8H', value: '8H' },
                { label: '24H', value: '24H' },
                { label: '7D', value: '7D' },
                { label: 'ALL', value: 'ALL' },
              ]}
              onChange={(v) => handleChange({ timeRange: v })}
            />
          </SettingRow>
          <SettingRow label="Wallet Filter">
            <CyberSelect
              value={settings.walletFilter}
              options={[
                { label: 'All', value: 'All' },
                { label: 'Edge Traders', value: 'Edge Traders' },
                { label: 'Whales', value: 'Whales' },
                { label: 'Custom', value: 'Custom' },
              ]}
              onChange={(v) => handleChange({ walletFilter: v })}
            />
          </SettingRow>
        </SettingsSection>
      </div>

      {/* Footer / Reset */}
      <div className="border-t border-[#1e293b]/40 px-4 py-3">
        <button
          onClick={handleReset}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition-all ${
            confirmReset
              ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20'
              : 'border-[#1e293b] bg-[#0a0e17] text-[#64748b] hover:border-[#64748b] hover:text-[#94a3b8]'
          }`}
        >
          <RotateCcw className="h-3 w-3" />
          {confirmReset ? 'CONFIRM RESET' : 'RESET TO DEFAULTS'}
        </button>
      </div>
    </div>
  )
}
