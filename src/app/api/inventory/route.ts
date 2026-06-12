import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(request.url)
  const checkId = searchParams.get('check_id')

  if (!checkId) {
    return NextResponse.json({ error: 'check_id required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('inventory_records')
    .select('*, products(name, sort_order)')
    .eq('check_id', checkId)
    .order('products(sort_order)', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const db = createServiceClient()
  const body = await request.json()
  // body: { check_id, product_id, delivery_qty, prev_stock, sold_qty, actual_stock }

  const { data: existing } = await db
    .from('inventory_records')
    .select('id')
    .eq('check_id', body.check_id)
    .eq('product_id', body.product_id)
    .single()

  if (existing) {
    const { data, error } = await db
      .from('inventory_records')
      .update({
        delivery_qty: body.delivery_qty ?? 0,
        prev_stock: body.prev_stock ?? 0,
        prev_month_carry: body.prev_month_carry ?? 0,
        sold_qty: body.sold_qty ?? 0,
        actual_stock: body.actual_stock ?? 0,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await db
    .from('inventory_records')
    .insert({
      check_id: body.check_id,
      product_id: body.product_id,
      delivery_qty: body.delivery_qty ?? 0,
      prev_stock: body.prev_stock ?? 0,
      prev_month_carry: body.prev_month_carry ?? 0,
      sold_qty: body.sold_qty ?? 0,
      actual_stock: body.actual_stock ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
