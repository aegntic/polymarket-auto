// Polymarket CLOB contract address on Polygon
export const POLYMARKET_CLOB = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const

// Polymarket USDC on Polygon
export const POLYMARKET_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const

// Simplified CLOB ABI for order creation
// The Polymarket CLOB uses createOrder with an Order struct
export const CLOB_ABI = [
  {
    name: 'createOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
          { name: 'maker', type: 'address' },
          { name: 'taker', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'makerAmount', type: 'uint256' },
          { name: 'takerAmount', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'feeRateBps', type: 'uint16' },
          { name: 'side', type: 'uint8' }, // 0 = BUY, 1 = SELL
          { name: 'signatureType', type: 'uint8' },
        ],
      },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
  },
] as const

// ERC20 ABI for USDC approval
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const
