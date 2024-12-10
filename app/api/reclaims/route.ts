import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const timestamp = Date.now()
    
    // Add id and timestamp if not present
    const reclaimData = {
      ...data,
      id: `reclaim_${timestamp}`,
      timestamp: new Date(timestamp).toISOString()
    }

    // Store in KV with timestamp as score for ordering
    await kv.zadd('reclaims', {
      score: timestamp,
      member: JSON.stringify(reclaimData)
    })

    return NextResponse.json({ success: true, data: reclaimData })
  } catch (err) {
    console.error('Error saving reclaim:', err)
    return NextResponse.json(
      { error: 'Failed to save reclaim' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get all reclaims, sorted by timestamp (newest first)
    const reclaims = await kv.zrange('reclaims', 0, -1, { rev: true })
    
    // Parse JSON strings back to objects
    const parsedReclaims = reclaims.map(r => JSON.parse(r as string))
    
    return NextResponse.json(parsedReclaims)
  } catch (err) {
    console.error('Error fetching reclaims:', err)
    return NextResponse.json([], { status: 500 })
  }
}

// Optional: Add cleanup method to remove old reclaims
export async function DELETE() {
  try {
    // Keep only last 1000 reclaims
    const total = await kv.zcard('reclaims')
    if (total > 1000) {
      await kv.zremrangebyrank('reclaims', 0, total - 1000)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error cleaning reclaims:', err)
    return NextResponse.json(
      { error: 'Failed to clean reclaims' }, 
      { status: 500 }
    )
  }
} 