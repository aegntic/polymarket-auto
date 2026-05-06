import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

export async function GET() {
  try {
    const wallets = await db.connectedWallet.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(wallets)
  } catch (error) {
    logger.error('WalletConnectAPI', 'Failed to fetch connected wallets', error)
    return NextResponse.json({ error: 'Failed to fetch connected wallets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address, label, network } = body as {
      address: string
      label?: string
      network?: string
    }

    if (!address || !isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address. Must be 0x followed by 40 hex characters.' },
        { status: 400 }
      )
    }

    const validNetworks = ['polygon', 'ethereum', 'base']
    const normalizedNetwork = validNetworks.includes(network ?? '') ? network! : 'polygon'

    // Check if wallet already exists
    const existing = await db.connectedWallet.findUnique({
      where: { address },
    })
    if (existing) {
      return NextResponse.json({ error: 'Wallet already connected' }, { status: 409 })
    }

    const wallet = await db.connectedWallet.create({
      data: {
        address,
        label: label ?? null,
        network: normalizedNetwork,
        balanceUsdc: 0,
        balanceMatic: 0,
        isActive: true,
        isFunded: false,
      },
    })

    return NextResponse.json(wallet, { status: 201 })
  } catch (error) {
    logger.error('WalletConnectAPI', 'Failed to connect wallet', error)
    return NextResponse.json({ error: 'Failed to connect wallet' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body as { id: string }

    if (!id) {
      return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 })
    }

    const existing = await db.connectedWallet.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    await db.connectedWallet.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('WalletConnectAPI', 'Failed to disconnect wallet', error)
    return NextResponse.json({ error: 'Failed to disconnect wallet' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, balanceUsdc, balanceMatic, isFunded } = body as {
      id: string
      balanceUsdc?: number
      balanceMatic?: number
      isFunded?: boolean
    }

    if (!id) {
      return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 })
    }

    const data: Record<string, unknown> = { lastSyncedAt: new Date() }
    if (balanceUsdc !== undefined) data.balanceUsdc = balanceUsdc
    if (balanceMatic !== undefined) data.balanceMatic = balanceMatic
    if (isFunded !== undefined) data.isFunded = isFunded

    const wallet = await db.connectedWallet.update({
      where: { id },
      data,
    })

    return NextResponse.json(wallet)
  } catch (error) {
    logger.error('WalletConnectAPI', 'Failed to update wallet', error)
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 })
  }
}
