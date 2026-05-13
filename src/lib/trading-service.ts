// Polymarket Trading Service
// Executes real trades on Polygon via viem + Polymarket smart contracts
// NOTE: This module is lazy-loaded to prevent ABI parsing errors from crashing the dashboard

import { createPublicClient, createWalletClient, http, parseAbi, type PublicClient, type WalletClient, type Hash, type Address } from 'viem'
import { polygon } from 'viem/chains'
import { logger } from './logger'

// Polymarket smart contract addresses (Polygon mainnet)
export const CONTRACTS = {
  // Conditional Tokens Framework (Polymarket uses Gnosis CTF on Polygon)
  conditionalTokens: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const,
  
  // USDC token (Native Circle USDC on Polygon)
  usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const,
  
  // Polymarket Exchange (NEG_RISK adapter for binary markets)
  negRiskExchange: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const,
}

// ABIs — lazy parsed to avoid module-load crashes
let _USDC_ABI: ReturnType<typeof parseAbi> | null = null
let _CLOB_ABI: ReturnType<typeof parseAbi> | null = null

function getUSDCABI() {
  if (!_USDC_ABI) {
    _USDC_ABI = parseAbi([
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address owner) view returns (uint256)',
    ])
  }
  return _USDC_ABI
}

function getCLOBABI() {
  if (!_CLOB_ABI) {
    _CLOB_ABI = parseAbi([
      'function createOrder(uint256 marketId, uint8 outcome, uint256 price, uint256 size) returns (uint256)',
      'function cancelOrder(uint256 orderId) returns (bool)',
    ])
  }
  return _CLOB_ABI
}

export interface TradeParams {
  marketId: string
  outcome: 'YES' | 'NO'
  price: number
  size: number
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
  try {
    const account = walletClient.account
    if (!account) throw new Error('No wallet account')
    
    const allowance = await publicClient.readContract({
      address: CONTRACTS.usdc as Address,
      abi: getUSDCABI(),
      functionName: 'allowance',
      args: [account.address, spender as Address],
    })
    
    return allowance as bigint
  } catch (error: any) {
    logger.error('TradingService', 'Error checking allowance:', error)
    return BigInt(0)
  }
}

// Approve USDC spending
export async function approveUSDC(
  publicClient: PublicClient,
  walletClient: WalletClient,
  amount: bigint,
  spender: string = CONTRACTS.negRiskExchange
): Promise<string> {
  const account = walletClient.account
  if (!account) throw new Error('No wallet account')
  
  const hash = await walletClient.writeContract({
    address: CONTRACTS.usdc as Address,
    abi: getUSDCABI(),
    functionName: 'approve',
    args: [spender as Address, amount],
    account: account.address,
    chain: polygon,
  })
  
  return hash
}

// Place a trade on Polymarket CLOB
export async function placeTrade(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: TradeParams
): Promise<TradeResult> {
  try {
    const account = walletClient.account
    if (!account) throw new Error('No wallet account')
    
    const priceWei = BigInt(Math.round(params.price * 1_000_000))
    const sizeWei = BigInt(Math.round(params.size * 1_000_000))
    const outcomeNum = params.outcome === 'YES' ? 1 : 0
    
    const hash = await walletClient.writeContract({
      address: CONTRACTS.negRiskExchange as Address,
      abi: getCLOBABI(),
      functionName: 'createOrder',
      args: [BigInt(params.marketId), outcomeNum, priceWei, sizeWei],
      account: account.address,
      chain: polygon,
    })
    
    return {
      success: true,
      transactionHash: hash,
    }
  } catch (error: any) {
    logger.error('TradingService', 'Error placing trade:', error)
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
