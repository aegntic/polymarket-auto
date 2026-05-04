// Polymarket Trading Service
// Executes real trades on Polygon via viem + Polymarket smart contracts

import { getContract, parseAbi, type WalletClient, type PublicClient } from 'viem'
import { polygon } from 'wagmi/chains'

// Polymarket smart contract addresses (Polygon mainnet)
export const CONTRACTS = {
  // Conditional Tokens Framework (Polymarket uses Gnosis CTF on Polygon)
  conditionalTokens: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const,
  
  // USDC token (Polygon PoS bridge)
  usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const,
  
  // Polymarket Exchange (NEG_RISK adapter for binary markets)
  negRiskExchange: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const,
}

// ABIs (simplified - full ABIs would be imported from @polymarket/sdk if available)
const USDC_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
])

const CLOB_ABI = parseAbi([
  'function createOrder(uint256 marketId, uint8 outcome, uint256 price, uint256 size) returns (uint256)',
  'function cancelOrder(uint256 orderId) returns (bool)',
  'function getOrder(uint256 orderId) view returns (tuple(uint256 id, address trader, uint256 marketId, uint8 outcome, uint256 price, uint256 size, uint8 status))',
])

export interface TradeParams {
  marketId: string // Condition ID
  outcome: 'YES' | 'NO'
  price: number // Price in USDC (0.01 to 0.99)
  size: number // Amount in USDC
}

export interface TradeResult {
  success: boolean
  transactionHash?: string
  orderId?: string
  error?: string
}

// Check USDC allowance for CLOB
export async function checkAllowance(
  publicClient: PublicClient,
  walletClient: WalletClient,
  spender: string = CONTRACTS.negRiskExchange
): Promise<bigint> {
  const contract = getContract({
    address: CONTRACTS.usdc,
    abi: USDC_ABI,
    client: { public: publicClient, waller: walletClient },
  })
  
  const allowance = await contract.read.allowance([
    walletClient.account!.address,
    spender as `0x${string}`,
  ])
  
  return allowance as bigint
}

// Approve USDC spending
export async function approveUSDC(
  publicClient: PublicClient,
  walletClient: WalletClient,
  amount: bigint,
  spender: string = CONTRACTS.negRiskExchange
): Promise<string> {
  const contract = getContract({
    address: CONTRACTS.usdc,
    abi: USDC_ABI,
    client: { public: publicClient, waller: walletClient },
  })
  
  const hash = await contract.write.approve([
    spender as `0x${string}`,
    amount,
  ])
  
  return hash
}

// Place a trade on Polymarket CLOB
export async function placeTrade(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: TradeParams
): Promise<TradeResult> {
  try {
    // Convert price to wei (6 decimals for USDC)
    const priceWei = BigInt(Math.round(params.price * 1_000_000))
    // Convert size to wei
    const sizeWei = BigInt(Math.round(params.size * 1_000_000))
    
    // Map outcome to number (0 = NO, 1 = YES typically)
    const outcomeNum = params.outcome === 'YES' ? 1 : 0
    
    const contract = getContract({
      address: CONTRACTS.negRiskExchange,
      abi: CLOB_ABI,
      client: { public: publicClient, waller: walletClient },
    })
    
    // Create order
    const hash = await contract.write.createOrder([
      BigInt(params.marketId),
      outcomeNum,
      priceWei,
      sizeWei,
    ])
    
    return {
      success: true,
      transactionHash: hash,
    }
  } catch (error: any) {
    console.error('[Trading] Error placing trade:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error',
    }
  }
}

// Buy YES tokens
export async function buyYes(
  publicClient: PublicClient,
  walletClient: WalletClient,
  marketId: string,
  price: number,
  size: number
): Promise<TradeResult> {
  return placeTrade(publicClient, walletClient, {
    marketId,
    outcome: 'YES',
    price,
    size,
  })
}

// Buy NO tokens
export async function buyNo(
  publicClient: PublicClient,
  walletClient: WalletClient,
  marketId: string,
  price: number,
  size: number
): Promise<TradeResult> {
  return placeTrade(publicClient, walletClient, {
    marketId,
    outcome: 'NO',
    price,
    size,
  })
}

// Format USDC amount (6 decimals)
export function formatUSDC(amount: bigint): number {
  return Number(amount) / 1_000_000
}

export function parseUSDC(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000))
}
