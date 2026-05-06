'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from 'lucide-react'
import type { Wallet, Trade } from '@/lib/store'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  label: string
  address: string
  totalPnl: number
  isEdgeTrader: boolean
  edgeScore: number
  winRate: number
  totalTrades: number
  marketIds: Set<string>
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
  sharedMarkets: number
  sharedMarketTitles: string[]
}

interface ProcessedGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ─── Force-Directed Layout Simulation ───────────────────────────────────────

function runForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 120
): void {
  const centerX = width / 2
  const centerY = height / 2
  const n = nodes.length

  if (n === 0) return

  // Build adjacency for quick lookup
  const edgeMap = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, new Set())
    if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, new Set())
    edgeMap.get(edge.source)!.add(edge.target)
    edgeMap.get(edge.target)!.add(edge.source)
  }

  // Initialize velocities
  for (const node of nodes) {
    node.vx = 0
    node.vy = 0
  }

  const repulsionStrength = 4000
  const attractionStrength = 0.008
  const centerGravity = 0.02
  const damping = 0.85

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations // cooling

    // Repulsion: all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const distSq = Math.max(dx * dx + dy * dy, 1)
        const dist = Math.sqrt(distSq)
        const force = (repulsionStrength * alpha) / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        nodes[i].vx -= fx
        nodes[i].vy -= fy
        nodes[j].vx += fx
        nodes[j].vy += fy
      }
    }

    // Attraction: along edges
    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const targetNode = nodes.find((n) => n.id === edge.target)
      if (!sourceNode || !targetNode) continue

      const dx = targetNode.x - sourceNode.x
      const dy = targetNode.y - sourceNode.y
      const dist = Math.sqrt(Math.max(dx * dx + dy * dy, 1))
      const idealLength = 100
      const force = (dist - idealLength) * attractionStrength * alpha * edge.sharedMarkets

      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      sourceNode.vx += fx
      sourceNode.vy += fy
      targetNode.vx -= fx
      targetNode.vy -= fy
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (centerX - node.x) * centerGravity * alpha
      node.vy += (centerY - node.y) * centerGravity * alpha
    }

    // Apply velocities with damping
    for (const node of nodes) {
      node.vx *= damping
      node.vy *= damping
      node.x += node.vx
      node.y += node.vy

      // Keep within bounds with padding
      const pad = 40
      node.x = Math.max(pad, Math.min(width - pad, node.x))
      node.y = Math.max(pad, Math.min(height - pad, node.y))
    }
  }
}

// ─── Market title map builder ───────────────────────────────────────────────

function buildMarketTitleMap(trades: Trade[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const trade of trades) {
    if (trade.market?.id && trade.market?.title) {
      if (!map.has(trade.market.id)) {
        map.set(trade.market.id, trade.market.title)
      }
    }
  }
  return map
}

// ─── Graph data processing ──────────────────────────────────────────────────

function buildGraphData(wallets: Wallet[], trades: Trade[]): ProcessedGraph {
  // Map walletId -> Set of marketIds
  const walletMarkets = new Map<string, Set<string>>()
  const walletMap = new Map<string, Wallet>()

  for (const wallet of wallets) {
    walletMarkets.set(wallet.id, new Set())
    walletMap.set(wallet.id, wallet)
  }

  for (const trade of trades) {
    const markets = walletMarkets.get(trade.walletId)
    if (markets && trade.marketId) {
      markets.add(trade.marketId)
    }
  }

  // Build market title map
  const marketTitles = buildMarketTitleMap(trades)

  // Create nodes
  const nodes: GraphNode[] = wallets.map((wallet, index) => {
    // Circle layout as initial position
    const angle = (2 * Math.PI * index) / wallets.length - Math.PI / 2
    const radius = 120
    return {
      id: wallet.id,
      label: wallet.label || truncateAddress(wallet.address),
      address: wallet.address,
      totalPnl: wallet.totalPnl,
      isEdgeTrader: wallet.isEdgeTrader,
      edgeScore: wallet.edgeScore,
      winRate: wallet.winRate,
      totalTrades: wallet.totalTrades,
      marketIds: walletMarkets.get(wallet.id) || new Set(),
      x: 200 + radius * Math.cos(angle),
      y: 175 + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    }
  })

  // Create edges: pairs of wallets that share at least 1 market
  const edges: GraphEdge[] = []
  for (let i = 0; i < wallets.length; i++) {
    for (let j = i + 1; j < wallets.length; j++) {
      const w1 = wallets[i]
      const w2 = wallets[j]
      const m1 = walletMarkets.get(w1.id) || new Set()
      const m2 = walletMarkets.get(w2.id) || new Set()

      const shared: string[] = []
      for (const m of m1) {
        if (m2.has(m)) shared.push(m)
      }

      if (shared.length > 0) {
        const sharedMarketTitles = shared
          .map((id) => marketTitles.get(id) || id)
          .slice(0, 5) // Limit to 5 for tooltip
        edges.push({
          source: w1.id,
          target: w2.id,
          sharedMarkets: shared.length,
          sharedMarketTitles,
        })
      }
    }
  }

  return { nodes, edges }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatPnl(pnl: number): string {
  if (Math.abs(pnl) >= 1000) {
    return `$${(pnl / 1000).toFixed(1)}k`
  }
  return `$${pnl.toFixed(0)}`
}

// ─── Tooltip component ──────────────────────────────────────────────────────

function NodeTooltip({
  node,
  connectedEdges,
  x,
  y,
}: {
  node: GraphNode
  connectedEdges: GraphEdge[]
  x: number
  y: number
}) {
  // Position tooltip to avoid going off-screen
  const tooltipWidth = 220
  const tooltipX = x + 15
  const tooltipY = y - 10

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: tooltipX,
        top: tooltipY,
        width: tooltipWidth,
      }}
    >
      <div
        className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/95 px-3 py-2.5 shadow-2xl backdrop-blur-sm"
        style={{ boxShadow: node.isEdgeTrader ? '0 0 20px rgba(0,255,65,0.15)' : '0 0 10px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: node.isEdgeTrader ? '#00ff41' : '#64748b',
              boxShadow: node.isEdgeTrader ? '0 0 6px #00ff41' : 'none',
            }}
          />
          <span className="font-mono text-xs font-bold text-[#e2e8f0]">
            {node.label}
          </span>
          {node.isEdgeTrader && (
            <span className="ml-auto rounded border border-[#00ff41]/30 bg-[#00ff41]/10 px-1 py-0.5 text-[8px] font-bold text-[#00ff41]">
              EDGE
            </span>
          )}
        </div>

        {/* Address */}
        <div className="mb-1.5 truncate font-mono text-[9px] text-[#64748b]">
          {node.address}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div className="text-[#64748b]">
            PnL:{' '}
            <span
              className="font-mono font-bold"
              style={{ color: node.totalPnl >= 0 ? '#00ff41' : '#ef4444' }}
            >
              {node.totalPnl >= 0 ? '+' : ''}
              {formatPnl(node.totalPnl)}
            </span>
          </div>
          <div className="text-[#64748b]">
            Win Rate:{' '}
            <span className="font-mono font-bold text-[#e2e8f0]">
              {(node.winRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-[#64748b]">
            Edge Score:{' '}
            <span className="font-mono font-bold text-[#00ff41]">
              {node.edgeScore.toFixed(2)}
            </span>
          </div>
          <div className="text-[#64748b]">
            Markets:{' '}
            <span className="font-mono font-bold text-[#e2e8f0]">
              {node.marketIds.size}
            </span>
          </div>
        </div>

        {/* Shared Markets */}
        {connectedEdges.length > 0 && (
          <div className="mt-2 border-t border-[#1e293b] pt-1.5">
            <div className="mb-1 text-[9px] uppercase tracking-wider text-[#64748b]">
              Shared Markets
            </div>
            {connectedEdges.slice(0, 3).map((edge) => {
              const otherId = edge.source === node.id ? edge.target : edge.source
              return (
                <div key={`${edge.source}-${edge.target}`} className="flex items-center gap-1 text-[9px] text-[#94a3b8]">
                  <span className="inline-block h-1 w-1 rounded-full bg-[#22d3ee]" />
                  <span className="font-mono">{otherId.slice(0, 8)}...</span>
                  <span className="ml-auto text-[#22d3ee]">
                    {edge.sharedMarkets} shared
                  </span>
                </div>
              )
            })}
            {connectedEdges.length > 3 && (
              <div className="mt-0.5 text-[8px] text-[#64748b]">
                +{connectedEdges.length - 3} more connections
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function WalletNetworkGraph() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: wallets, isLoading: walletsLoading } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { data: trades, isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/trades').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const isLoading = walletsLoading || tradesLoading

  // Process graph data and run force simulation
  const graphData = useMemo(() => {
    if (!wallets || !trades || wallets.length === 0) {
      return { nodes: [], edges: [] }
    }

    const data = buildGraphData(wallets, trades)

    // Run force-directed layout simulation
    const svgWidth = 400
    const svgHeight = 350
    runForceSimulation(data.nodes, data.edges, svgWidth, svgHeight, 150)

    return data
  }, [wallets, trades])

  // Compute node sizes based on PnL
  const { nodeSizeMap, maxPnl, minPnl } = useMemo(() => {
    const sizeMap = new Map<string, number>()
    if (graphData.nodes.length === 0) return { nodeSizeMap: sizeMap, maxPnl: 0, minPnl: 0 }

    let max = -Infinity
    let min = Infinity
    for (const node of graphData.nodes) {
      max = Math.max(max, node.totalPnl)
      min = Math.min(min, node.totalPnl)
    }

    for (const node of graphData.nodes) {
      // Base size: edge traders get bigger base
      const baseSize = node.isEdgeTrader ? 14 : 8
      // Scale by PnL: normalize to 0-1 range then add size
      const pnlRange = max - min || 1
      const normalizedPnl = (node.totalPnl - min) / pnlRange
      const pnlBonus = normalizedPnl * 10 // 0 to 10 extra pixels
      sizeMap.set(node.id, baseSize + pnlBonus)
    }

    return { nodeSizeMap: sizeMap, maxPnl: max, minPnl: min }
  }, [graphData.nodes])

  // Compute edge thickness and opacity
  const { edgeThicknessMap, maxSharedMarkets } = useMemo(() => {
    const thicknessMap = new Map<string, number>()
    let max = 0
    for (const edge of graphData.edges) {
      max = Math.max(max, edge.sharedMarkets)
    }
    for (const edge of graphData.edges) {
      const key = `${edge.source}-${edge.target}`
      // Thickness from 1 to 4 based on shared markets
      const normalized = max > 0 ? edge.sharedMarkets / max : 0
      thicknessMap.set(key, 1 + normalized * 3)
    }
    return { edgeThicknessMap: thicknessMap, maxSharedMarkets: max }
  }, [graphData.edges])

  // Get connected edges for a node
  const getNodeEdges = useCallback(
    (nodeId: string) =>
      graphData.edges.filter((e) => e.source === nodeId || e.target === nodeId),
    [graphData.edges]
  )

  // Check if a node is connected to the hovered node
  const isConnectedToHovered = useCallback(
    (nodeId: string) => {
      if (!hoveredNode) return true
      if (nodeId === hoveredNode) return true
      return graphData.edges.some(
        (e) =>
          (e.source === hoveredNode && e.target === nodeId) ||
          (e.target === hoveredNode && e.source === nodeId)
      )
    },
    [hoveredNode, graphData.edges]
  )

  // Check if an edge is connected to hovered node
  const isEdgeHighlighted = useCallback(
    (edge: GraphEdge) => {
      if (!hoveredNode) return true
      return edge.source === hoveredNode || edge.target === hoveredNode
    },
    [hoveredNode]
  )

  // Mouse handlers
  const handleNodeMouseEnter = useCallback(
    (nodeId: string) => {
      setHoveredNode(nodeId)
    },
    []
  )

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [])

  const handleNodeMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    },
    []
  )

  // Stats
  const stats = useMemo(() => {
    const edgeTraderCount = graphData.nodes.filter((n) => n.isEdgeTrader).length
    const connectionCount = graphData.edges.length
    return { edgeTraderCount, connectionCount }
  }, [graphData])

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Network className="h-4 w-4 text-[#22d3ee]" />
            WALLET NETWORK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full bg-[#1e293b]/50" />
          <div className="mt-3 flex gap-4">
            <Skeleton className="h-4 w-24 bg-[#1e293b]/50" />
            <Skeleton className="h-4 w-24 bg-[#1e293b]/50" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (graphData.nodes.length === 0) {
    return (
      <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Network className="h-4 w-4 text-[#22d3ee]" />
            WALLET NETWORK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-xs text-[#64748b]">
            No wallet data available
          </p>
        </CardContent>
      </Card>
    )
  }

  const hoveredNodeData = hoveredNode
    ? graphData.nodes.find((n) => n.id === hoveredNode) ?? null
    : null

  return (
    <Card className="card-accent-green card-hover-glow border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Network className="h-4 w-4 text-[#22d3ee]" />
            WALLET NETWORK
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-[#00ff41]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00ff41] animate-pulse" />
              {stats.edgeTraderCount} edge
            </span>
            <span className="flex items-center gap-1 text-[#22d3ee]">
              <span className="inline-block h-1 w-3 rounded-full bg-[#22d3ee]/60" />
              {stats.connectionCount} links
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative" ref={containerRef}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 400 350"
            className="w-full h-auto"
            style={{ maxHeight: '380px' }}
          >
            <defs>
              {/* Glow filter for edge trader nodes */}
              <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="0 0 0 0 0  0 1 0 0 1  0 0 0 0 0.25  0 0 0 1 0"
                  result="green-blur"
                />
                <feMerge>
                  <feMergeNode in="green-blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Subtle glow for edges */}
              <filter id="edge-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Radial gradient for edge trader nodes */}
              <radialGradient id="edge-node-gradient" cx="35%" cy="35%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#00ff41" />
              </radialGradient>
              {/* Radial gradient for non-edge nodes */}
              <radialGradient id="normal-node-gradient" cx="35%" cy="35%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#64748b" />
              </radialGradient>
            </defs>

            {/* Background grid pattern */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#1e293b"
                strokeWidth="0.3"
                opacity="0.4"
              />
            </pattern>
            <rect width="400" height="350" fill="url(#grid)" />

            {/* Edges */}
            <g>
              {graphData.edges.map((edge) => {
                const sourceNode = graphData.nodes.find((n) => n.id === edge.source)
                const targetNode = graphData.nodes.find((n) => n.id === edge.target)
                if (!sourceNode || !targetNode) return null

                const key = `${edge.source}-${edge.target}`
                const thickness = edgeThicknessMap.get(key) ?? 1.5
                const highlighted = isEdgeHighlighted(edge)
                const normalizedShared =
                  maxSharedMarkets > 0 ? edge.sharedMarkets / maxSharedMarkets : 0
                const baseOpacity = 0.15 + normalizedShared * 0.35

                return (
                  <motion.line
                    key={key}
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="#22d3ee"
                    strokeWidth={thickness}
                    strokeLinecap="round"
                    opacity={highlighted ? baseOpacity + 0.25 : baseOpacity * 0.4}
                    filter={highlighted ? 'url(#edge-line-glow)' : undefined}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: highlighted ? baseOpacity + 0.25 : baseOpacity * 0.4 }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                )
              })}
            </g>

            {/* Nodes */}
            <g>
              {graphData.nodes.map((node) => {
                const size = nodeSizeMap.get(node.id) ?? 10
                const connected = isConnectedToHovered(node.id)
                const opacity = connected ? 1 : 0.25

                return (
                  <motion.g
                    key={node.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    onMouseEnter={() => handleNodeMouseEnter(node.id)}
                    onMouseLeave={handleNodeMouseLeave}
                    onMouseMove={handleNodeMouseMove}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Outer glow ring for edge traders */}
                    {node.isEdgeTrader && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={size + 4}
                        fill="none"
                        stroke="#00ff41"
                        strokeWidth="1"
                        opacity={0.3}
                        filter="url(#edge-glow)"
                      >
                        <animate
                          attributeName="r"
                          values={`${size + 3};${size + 6};${size + 3}`}
                          dur="3s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.3;0.15;0.3"
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Main node circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={size}
                      fill={
                        node.isEdgeTrader
                          ? 'url(#edge-node-gradient)'
                          : 'url(#normal-node-gradient)'
                      }
                      stroke={node.isEdgeTrader ? '#00ff41' : '#334155'}
                      strokeWidth={node.isEdgeTrader ? 1.5 : 0.8}
                      filter={node.isEdgeTrader ? 'url(#edge-glow)' : undefined}
                      opacity={opacity}
                    />

                    {/* PnL indicator dot */}
                    <circle
                      cx={node.x + size * 0.6}
                      cy={node.y - size * 0.6}
                      r={2.5}
                      fill={node.totalPnl >= 0 ? '#00ff41' : '#ef4444'}
                      opacity={opacity * 0.9}
                    />

                    {/* Label */}
                    <text
                      x={node.x}
                      y={node.y + size + 12}
                      textAnchor="middle"
                      fill={node.isEdgeTrader ? '#e2e8f0' : '#64748b'}
                      fontSize={node.isEdgeTrader ? 9 : 8}
                      fontFamily="monospace"
                      fontWeight={node.isEdgeTrader ? 700 : 400}
                      opacity={opacity}
                    >
                      {node.label.length > 14
                        ? node.label.slice(0, 14) + '…'
                        : node.label}
                    </text>
                  </motion.g>
                )
              })}
            </g>
          </svg>
        </motion.div>

        {/* Tooltip */}
        {hoveredNodeData && (
          <NodeTooltip
            node={hoveredNodeData}
            connectedEdges={getNodeEdges(hoveredNodeData.id)}
            x={tooltipPos.x}
            y={tooltipPos.y}
          />
        )}

        {/* Legend */}
        <motion.div
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#1e293b]/50 pt-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {/* Node: Edge Trader */}
          <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                backgroundColor: '#00ff41',
                boxShadow: '0 0 4px #00ff41',
              }}
            />
            Edge Trader
          </div>

          {/* Node: Regular */}
          <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#64748b]" />
            Regular Wallet
          </div>

          {/* Node size */}
          <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
            <svg width="28" height="14" className="inline-block">
              <circle cx="6" cy="7" r="4" fill="#64748b" opacity="0.7" />
              <circle cx="20" cy="7" r="7" fill="#00ff41" opacity="0.5" />
            </svg>
            Size = PnL
          </div>

          {/* Edge */}
          <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
            <svg width="28" height="10" className="inline-block">
              <line x1="0" y1="5" x2="28" y2="5" stroke="#22d3ee" strokeWidth="2" opacity="0.5" />
            </svg>
            Shared Markets
          </div>

          {/* Edge thickness */}
          <div className="flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
            <svg width="28" height="10" className="inline-block">
              <line x1="0" y1="5" x2="28" y2="5" stroke="#22d3ee" strokeWidth="1" opacity="0.3" />
              <line x1="0" y1="5" x2="28" y2="5" stroke="#22d3ee" strokeWidth="3" opacity="0.6" />
            </svg>
            Thicker = More Overlap
          </div>
        </motion.div>
      </CardContent>
    </Card>
  )
}
