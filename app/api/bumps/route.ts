import { NextResponse } from 'next/server'
import { BumpRecord } from '@/app/types/bump'

// In-memory fallback if KV isn't available
const localBumps: BumpRecord[] = []

export async function GET() {
  try {
    // Try to use KV if available
    let bumps: BumpRecord[] = []
    
    try {
      const { kv } = await import('@vercel/kv')
      bumps = await kv.lrange('bumps', 0, 49)
      bumps = bumps.map(b => typeof b === 'string' ? JSON.parse(b) : b)
    } catch {
      // Fallback to local storage if KV fails
      bumps = localBumps
    }

    return NextResponse.json(bumps)
  } catch (error) {
    console.error('Error fetching bumps:', error)
    // Return empty array instead of error
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const bump: BumpRecord = await request.json()
    
    try {
      const { kv } = await import('@vercel/kv')
      await kv.lpush('bumps', JSON.stringify(bump))
    } catch {
      // Fallback to local storage
      localBumps.unshift(bump)
      if (localBumps.length > 50) localBumps.pop()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving bump:', error)
    return NextResponse.json({ error: 'Failed to save bump' }, { status: 500 })
  }
} 