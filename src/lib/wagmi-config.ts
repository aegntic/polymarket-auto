// Wagmi configuration for Polygon mainnet (Polymarket)
import { http, createConfig } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const config = getDefaultConfig({
  appName: 'Polymarket Auto',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [polygon],
  ssr: true,
})
