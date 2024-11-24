import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { BumpRecord } from '@/app/types/bump'

export async function GET() {
  try {
    const bumps = await kv.lrange('bumps', 0, 49)
    return NextResponse.json(bumps.map(b => JSON.parse(b)))
  } catch (error) {
    console.error('Error fetching bumps:', error)
    return NextResponse.json({ error: 'Failed to fetch bumps' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const bump: BumpRecord = await request.json()
    await kv.lpush('bumps', JSON.stringify(bump))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving bump:', error)
    return NextResponse.json({ error: 'Failed to save bump' }, { status: 500 })
  }
} 