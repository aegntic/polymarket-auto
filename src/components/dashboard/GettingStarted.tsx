'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  Zap,
  BarChart3,
  Brain,
  ArrowRight,
  Check,
  Globe,
  TrendingUp,
  X,
} from 'lucide-react'
import { useDashboardStore } from '@/lib/store'
import { useAccount } from 'wagmi'

const STORAGE_KEY = 'polyagent-onboarding-dismissed'

const steps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Link your Polygon wallet to track balances and enable trading.',
    color: '#00ff41',
  },
  {
    icon: Globe,
    title: 'Scan Markets',
    description: 'Agent scans top wallets and Polymarket markets for opportunities.',
    color: '#22d3ee',
  },
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'xAI Grok-4.20 analyzes edge scores and sentiment for trade decisions.',
    color: '#8247e5',
  },
  {
    icon: TrendingUp,
    title: 'Trade & Monitor',
    description: 'Execute trades with Kelly criterion sizing and track performance.',
    color: '#f59e0b',
  },
]

export function GettingStarted() {
  const [visible, setVisible] = useState(false)
  const walletAddress = useDashboardStore((s) => s.walletAddress)
  const { isConnected } = useAccount()

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed && !walletAddress) {
      setVisible(true)
    }
  }, [walletAddress])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        className="relative z-30 mx-auto max-w-3xl p-3 sm:p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        <div className="rounded-2xl border border-[#1e293b]/80 bg-[#0f1724]/95 p-5 shadow-2xl shadow-black/20 sm:p-8 backdrop-blur-xl">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#e2e8f0] sm:text-2xl">
                Welcome to PolyAgent
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-[#64748b]">
                Autonomous Polymarket trading with AI-powered edge detection.
                Get started in 4 steps.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-[#1e293b]/50 hover:text-[#94a3b8]"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Wallet connected badge */}
          {isConnected && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#00ff41]/20 bg-[#00ff41]/5 px-3 py-2">
              <Check className="h-4 w-4 text-[#00ff41]" />
              <span className="text-sm font-medium text-[#00ff41]">Wallet connected</span>
            </div>
          )}

          {/* Steps */}
          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="group relative overflow-hidden rounded-xl border border-[#1e293b]/60 bg-[#0a0e17]/60 p-4 transition-colors hover:border-[#1e293b]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                {/* Step number */}
                <div
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-bl-lg rounded-tr-xl text-[10px] font-bold"
                  style={{ backgroundColor: `${step.color}15`, color: step.color }}
                >
                  {i + 1}
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${step.color}12` }}
                  >
                    <step.icon className="h-4 w-4" style={{ color: step.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#e2e8f0]">{step.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Dismiss */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-[11px] text-[#475569]">
              Connect a wallet to begin scanning markets.
            </p>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#1e293b]/50 hover:text-[#94a3b8]"
            >
              Got it
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
