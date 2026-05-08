// Wagmi configuration for Polygon mainnet (Polymarket)
import { http } from 'wagmi'
import { polygon, mainnet } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'b56e18d47c72ab683b10814fe9495694'

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn('[wagmi-config] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set — using localhost testing ID. Create a project at https://dashboard.reown.com for production.')
}

export const config = getDefaultConfig({
  appName: 'PolyAgent',
  projectId,
  chains: [polygon, mainnet],
  transports: {
    [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
    [mainnet.id]: http('https://eth.llamarpc.com'),
  },
  ssr: true,
})
