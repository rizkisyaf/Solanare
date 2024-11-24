import { NextResponse } from 'next/server'
import { BumpRecord } from '@/app/types/bump'

const localBumps: BumpRecord[] = []

export async function GET() {
  try {
    let bumps: BumpRecord[] = []
    
    try {
      const { kv } = await import('@vercel/kv')
      bumps = await kv.lrange('bumps', 0, 49) || []
      bumps = bumps.map(b => typeof b === 'string' ? JSON.parse(b) : b)
    } catch (err) {
      console.error('KV error:', err)
      bumps = localBumps
    }

    return NextResponse.json(bumps)
  } catch (err) {
    console.error('Error fetching bumps:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const bump: BumpRecord = await request.json()
    
    try {
      const { kv } = await import('@vercel/kv')
      await kv.lpush('bumps', JSON.stringify(bump))
    } catch (err) {
      console.error('KV error:', err)
      localBumps.unshift(bump)
      if (localBumps.length > 50) localBumps.pop()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error saving bump:', err)
    return NextResponse.json({ error: 'Failed to save bump' }, { status: 500 })
  }
} 