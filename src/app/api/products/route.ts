import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const db = createServiceClient()
  const { name } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: '商品名を入力してください' }, { status: 400 })
  }

  const { data: maxRow } = await db
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await db
    .from('products')
    .insert({ name: name.trim(), sort_order: (maxRow?.sort_order ?? 0) + 1 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
