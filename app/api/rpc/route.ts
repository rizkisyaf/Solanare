import { NextRequest, NextResponse } from 'next/server'

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('RPC proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 