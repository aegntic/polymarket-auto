'use client'

import { useAccount, useBalance, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useDashboardStore } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  Wallet,
  Check,
  Copy,
  ExternalLink,
  Unplug,
  DollarSign,
} from 'lucide-react'
import { useState } from 'react'

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletConnectPanel() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({
    address,
    contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
    chainId: 137,
  })
  const { data: maticBalance } = useBalance({ address, chainId: 137 })
  const setWalletConnection = useDashboardStore((s) => s.setWalletConnection)
  const [copied, setCopied] = useState(false)

  // Sync wallet connection to store
  if (isConnected && address) {
    setWalletConnection(address, balance ? parseFloat(balance.value.toString()) / Math.pow(10, balance.decimals) : undefined)
  }

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      className="glass-card-v2 card-accent-green rounded-xl border border-[#1e293b]/60"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Card Header */}
      <div className="flex items-center gap-2.5 border-b border-[#1e293b]/40 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00ff41]/10">
          <Wallet className="h-4 w-4 text-[#00ff41]" />
        </div>
        <h2 className="card-title-cyber">WALLET CONNECT</h2>
        {isConnected && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[#00ff41]/30 bg-[#00ff41]/10 px-2 py-0.5 text-[9px] font-bold text-[#00ff41]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
            CONNECTED
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        {!isConnected ? (
          /* ─── Section A: Not Connected ─── */
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ConnectButton
              showBalance={{ smallScreen: false, largeScreen: true }}
              chainStatus={{ smallScreen: 'icon', largeScreen: 'full' }}
              accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
            />

            {/* Simulated Mode Warning */}
            <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-3 py-2.5">
              <span className="text-[10px] leading-relaxed text-[#f59e0b]">
                <strong>Prod Mode</strong> — Real wallet connection enabled via RainbowKit. Connect using MetaMask, WalletConnect, or other providers.
              </span>
            </div>
          </motion.div>
        ) : (
          /* ─── Section B: Wallet Connected ─── */
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Address + Network */}
            <div className="flex items-center gap-3 rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00ff41]/10">
                <Wallet className="h-4 w-4 text-[#00ff41]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#e2e8f0]">
                    {truncateAddress(address!)}
                  </span>
                  <button
                    onClick={copyAddress}
                    className="shrink-0 rounded p-1 text-[#64748b] transition-colors hover:bg-[#1e293b] hover:text-[#94a3b8]"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-[#00ff41]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold border-[#8247e5]/40 bg-[#8247e5]/10 text-[#8247e5]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#8247e5]" />
                    Polygon
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#00ff41]" />
                <span className="text-[10px] font-semibold text-[#00ff41]">Connected</span>
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-2">
                <div className="text-[9px] font-medium uppercase tracking-wider text-[#64748b]">USDC Balance</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-[#00ff41] glow-green">
                  ${balance ? (parseFloat(balance.value.toString()) / Math.pow(10, balance.decimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>
              <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-2">
                <div className="text-[9px] font-medium uppercase tracking-wider text-[#64748b]">MATIC Balance</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-[#8247e5]">
                  {maticBalance ? (parseFloat(maticBalance.value.toString()) / Math.pow(10, maticBalance.decimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.0000'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`https://polygonscan.com/address/${address}`, '_blank')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/10 py-2 text-xs font-bold text-[#22d3ee] transition-all hover:bg-[#22d3ee]/20"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Polygonscan
              </button>
              <button
                onClick={() => {
                  disconnect()
                  setWalletConnection(null)
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/5 px-3 py-2 text-xs font-bold text-[#ef4444] transition-all hover:bg-[#ef4444]/10"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
