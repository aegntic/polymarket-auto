'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  ArrowRight,
  Check,
  Globe,
  TrendingUp,
  X,
  Rocket,
} from 'lucide-react'
import { useDashboardStore } from '@/lib/store'
import { useAccount } from 'wagmi'

const STORAGE_KEY = 'polyagent-onboarding-dismissed'

const steps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Link your Polygon wallet via MetaMask, Rainbow, or WalletConnect.',
    color: '#00ff41',
    action: 'Click Connect in the top-right',
  },
  {
    icon: Globe,
    title: 'Markets Load Automatically',
    description: '100+ live Polymarket markets appear instantly with real prices.',
    color: '#22d3ee',
    action: 'Browse the Market Scanner tab',
  },
  {
    icon: TrendingUp,
    title: 'Track Performance',
    description: 'Your portfolio, P&L, and trade history update in real-time.',
    color: '#f59e0b',
    action: 'View the Overview dashboard',
  },
]

export function GettingStarted({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const walletAddress = useDashboardStore((s) => s.walletAddress)
  const { isConnected } = useAccount()

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed && !walletAddress) {
      setVisible(true)
    }
  }, [walletAddress])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
    onDismiss()
  }, [onDismiss])

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e17]/95 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="w-full max-w-2xl rounded-2xl border border-[#1e293b]/80 bg-[#0f1724] p-6 shadow-2xl sm:p-8"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#e2e8f0] sm:text-2xl">
                Welcome to PolyAgent
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-[#64748b]">
                Autonomous Polymarket trading with AI-powered edge detection.
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
          <div className="space-y-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="flex items-start gap-3 rounded-xl border border-[#1e293b]/60 bg-[#0a0e17]/60 p-4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: `${step.color}15`, color: step.color }}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[#e2e8f0]">{step.title}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">
                    {step.description}
                  </p>
                  <p className="mt-1 text-[10px] font-medium" style={{ color: step.color }}>
                    {step.action}
                  </p>
                </div>
                <step.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: `${step.color}60` }} />
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-[11px] text-[#475569]">
              {isConnected
                ? 'You\'re all set! Dismiss to start trading.'
                : 'Connect a wallet to begin.'}
            </p>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-2 rounded-lg bg-[#00ff41]/10 px-4 py-2 text-sm font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20"
            >
              <Rocket className="h-4 w-4" />
              Start Trading
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
