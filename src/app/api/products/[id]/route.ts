import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = createServiceClient()
  const { id } = await params
  const body = await request.json()

  const allowed: Record<string, unknown> = {}
  if (body.name !== undefined) allowed.name = body.name.trim()
  if (body.active !== undefined) allowed.active = body.active
  if (body.sort_order !== undefined) allowed.sort_order = body.sort_order

  const { data, error } = await db
    .from('products')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = createServiceClient()
  const { id } = await params

  const { error } = await db.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
