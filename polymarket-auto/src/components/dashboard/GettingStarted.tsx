'use client'

import { motion } from 'framer-motion'
import {
  Wallet,
  Zap,
  BarChart3,
  Shield,
  ArrowRight,
  Check,
  Globe,
  Brain,
  TrendingUp,
} from 'lucide-react'
import { useDashboardStore } from '@/lib/store'
import { useAccount } from 'wagmi'

interface GettingStartedProps {
  onDismiss: () => void
}

const steps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Link your Polygon wallet to track balances and enable trading.',
    action: 'Connect',
    color: '#00ff41',
  },
  {
    icon: Globe,
    title: 'Scan Markets',
    description: 'Agent scans top wallets and Polymarket markets for opportunities.',
    action: 'Scan Markets',
    color: '#22d3ee',
  },
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'xAI Grok-4.20 analyzes edge scores and sentiment for trade decisions.',
    action: 'Run Analysis',
    color: '#8247e5',
  },
  {
    icon: TrendingUp,
    title: 'Trade & Monitor',
    description: 'Execute trades with Kelly criterion sizing and track performance.',
    action: 'View Markets',
    color: '#f59e0b',
  },
]

export function GettingStarted({ onDismiss }: GettingStartedProps) {
  const walletAddress = useDashboardStore((s) => s.walletAddress)
  const { isConnected } = useAccount()

  return (
    <motion.div
      className="relative z-30 mx-auto max-w-4xl p-3 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="rounded-2xl border border-[#1e293b]/80 bg-[#0f1724]/90 p-5 sm:p-8 backdrop-blur-xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#e2e8f0] sm:text-2xl">
              Welcome to PolyAgent
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Autonomous Polymarket trading with AI-powered edge detection
            </p>
          </div>
          {walletAddress && (
            <div className="flex items-center gap-1.5 rounded-full border border-[#00ff41]/30 bg-[#00ff41]/10 px-3 py-1">
              <Check className="h-3.5 w-3.5 text-[#00ff41]" />
              <span className="text-xs font-semibold text-[#00ff41]">Wallet Connected</span>
            </div>
          )}
        </div>

        {/* Quick Status */}
        {!isConnected && (
          <div className="mb-6 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-4 py-3">
            <p className="text-sm text-[#f59e0b]">
              <strong>Start here:</strong> Connect your wallet using the button below, then follow the steps.
            </p>
          </div>
        )}

        {/* Steps */}
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className="group relative rounded-xl border border-[#1e293b]/60 bg-[#0a0e17]/60 p-4 transition-colors hover:border-[#1e293b]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${step.color}15` }}
                >
                  <step.icon className="h-4 w-4" style={{ color: step.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#e2e8f0]">{step.title}</h3>
                    <span className="shrink-0 text-[10px] font-bold text-[#64748b]">
                      STEP {i + 1}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dismiss */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#1e293b]/50 hover:text-[#94a3b8]"
          >
            Dismiss
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
