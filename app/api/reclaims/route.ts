import { put, list } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const data = await request.json()
  
  const blob = await put(`reclaims/${Date.now()}.json`, JSON.stringify(data), {
    access: 'public',
  })

  return NextResponse.json(blob)
}

export async function GET() {
  const { blobs } = await list()
  const reclaims = await Promise.all(
    blobs.map(async (blob) => {
      const response = await fetch(blob.url)
      return response.json()
    })
  )

  return NextResponse.json(reclaims)
} 