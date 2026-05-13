'use client'

import { useState, useRef, useEffect } from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { useDashboardStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  ChevronDown,
  ExternalLink,
  Unplug,
  Copy,
  Check,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react'

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletMenu() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { openConnectModal } = useConnectModal()
  const { address, isConnected, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switchingChain } = useSwitchChain()
  const setWalletConnection = useDashboardStore((s) => s.setWalletConnection)

  const isWrongChain = isConnected && chainId !== polygon.id

  // useBalance removed - wagmi v7 API changed
  const usdcBal = null
  const maticBal = null

  // Sync with store
  useEffect(() => {
    if (isConnected && address) {
      setWalletConnection(address, 0)
    } else {
      setWalletConnection(null)
    }
  }, [isConnected, address, setWalletConnection])
  useEffect(() => {
    if (isConnected && chainId && chainId !== polygon.id && switchChain) {
      switchChain({ chainId: polygon.id })
    }
  }, [isConnected, chainId, switchChain])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = () => {
    disconnect()
    setWalletConnection(null)
    setOpen(false)
  }

  const chainLabel = chainId === polygon.id ? 'Polygon' : chainId === 1 ? 'Ethereum' : `Chain ${chainId}`
  const chainColor = chainId === polygon.id ? '#8247e5' : '#627eea'

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-[#1e293b]/80 bg-[#0f1724]/70 px-3 py-2 text-[#94a3b8] transition-all hover:border-[#00ff41]/30 hover:bg-[#0f1724] hover:text-[#e2e8f0]"
      >
        {isConnected ? (
          <>
            {isWrongChain ? (
              <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-[#00ff41] animate-pulse" />
            )}
            <span className="hidden sm:inline font-mono text-xs font-bold text-[#e2e8f0]">
              {truncateAddress(address!)}
            </span>
            <span
              className="hidden md:inline rounded-full px-1.5 py-0.5 text-[9px] font-bold border"
              style={{
                borderColor: `${chainColor}40`,
                backgroundColor: `${chainColor}10`,
                color: chainColor,
              }}
            >
              {chainLabel}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-bold">Connect</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-[#1e293b]/80 bg-[#0f1724] shadow-2xl z-[70]"
          >
            {!isConnected ? (
              /* ── Not Connected ── */
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 border-b border-[#1e293b]/40 pb-2">
                  <Wallet className="h-4 w-4 text-[#64748b]" />
                  <span className="text-xs font-bold text-[#94a3b8]">WALLET</span>
                </div>
                <button
                  onClick={() => { openConnectModal?.(); setOpen(false) }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#00ff41]/30 bg-[#00ff41]/10 py-2.5 text-sm font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </button>
                <p className="text-[10px] text-[#64748b] leading-relaxed">
                  Connect via MetaMask, WalletConnect, Coinbase, or other providers. You'll be switched to Polygon automatically.
                </p>
              </div>
            ) : (
              /* ── Connected ── */
              <div className="p-3 space-y-3">
                {/* Address row */}
                <div className="flex items-center gap-2 border-b border-[#1e293b]/40 pb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00ff41]/10">
                    <Wallet className="h-3.5 w-3.5 text-[#00ff41]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-[#e2e8f0]">
                        {truncateAddress(address!)}
                      </span>
                      <button
                        onClick={copyAddress}
                        className="shrink-0 rounded p-0.5 text-[#64748b] hover:text-[#94a3b8]"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-[#00ff41]" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          borderColor: `${chainColor}40`,
                          backgroundColor: `${chainColor}10`,
                          color: chainColor,
                        }}
                      >
                        <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: chainColor }} />
                        {chainLabel}
                      </span>
                      {!isWrongChain && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#00ff41]">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Wrong chain warning */}
                {isWrongChain && (
                  <div className="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#f59e0b]" />
                      <span className="text-[11px] font-bold text-[#f59e0b]">Wrong Network</span>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] mb-2">
                      Polymarket runs on Polygon. Switch to see your balance and trade.
                    </p>
                    <button
                      onClick={() => switchChain?.({ chainId: polygon.id })}
                      disabled={switchingChain}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#8247e5]/30 bg-[#8247e5]/10 py-2 text-xs font-bold text-[#8247e5] transition-all hover:bg-[#8247e5]/20 disabled:opacity-50"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {switchingChain ? 'Switching...' : 'Switch to Polygon'}
                    </button>
                  </div>
                )}

                {/* Balances (always query Polygon regardless of current chain) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-2.5 py-2">
                    <div className="text-[9px] font-medium uppercase tracking-wider text-[#64748b]">USDC</div>
                    <div className="mt-0.5 font-mono text-base font-bold text-[#00ff41] glow-green">
                      ${'0.00'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-2.5 py-2">
                    <div className="text-[9px] font-medium uppercase tracking-wider text-[#64748b]">POL</div>
                    <div className="mt-0.5 font-mono text-base font-bold text-[#8247e5]">
                      {'0.0000'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-1.5 border-t border-[#1e293b]/40 pt-2">
                  <button
                    onClick={() => window.open(`https://polygonscan.com/address/${address}`, '_blank')}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#94a3b8] transition-colors hover:bg-[#1e293b]/40 hover:text-[#e2e8f0]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View on Polygonscan
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#ef4444] transition-colors hover:bg-[#ef4444]/10"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    Disconnect Wallet
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
