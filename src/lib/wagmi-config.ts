// Wagmi configuration for Polygon mainnet (Polymarket)
import { http } from 'wagmi'
import { polygon, mainnet } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!projectId) {
  throw new Error('[wagmi-config] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required. Get one at https://dashboard.reown.com')
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
