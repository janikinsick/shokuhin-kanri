import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// POSデータCSVフォーマット:
// B列(index 1): 決済日時 "2026/06/01 13:01:07"
// C列(index 2): 商品名
// E列(index 4): 数量

export async function POST(request: NextRequest) {
  const db = createServiceClient()
  const body = await request.json()
  const { csv } = body as { csv: string }

  const lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean)
  if (lines.length < 2) return NextResponse.json({ error: 'CSVが空です' }, { status: 400 })

  // 商品名→IDのマップ
  const { data: products } = await db.from('products').select('id, name')
  const productMap: Record<string, string> = {}
  for (const p of products ?? []) productMap[p.name] = p.id

  // 日付×商品ごとに数量を集計
  const salesMap: Record<string, Record<string, number>> = {}
  // date → productId → qty

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const dateTimeRaw = cols[1]?.replace(/"/g, '').trim()
    const productName = cols[2]?.replace(/"/g, '').trim()
    const qty = Number(cols[4]?.replace(/"/g, '').trim()) || 0

    if (!dateTimeRaw || !productName || !qty) continue

    // "2026/06/01 13:01:07" → "2026-06-01"
    const dateStr = dateTimeRaw.slice(0, 10).replace(/\//g, '-')
    const productId = productMap[productName]
    if (!productId) continue

    if (!salesMap[dateStr]) salesMap[dateStr] = {}
    salesMap[dateStr][productId] = (salesMap[dateStr][productId] ?? 0) + qty
  }

  const dates = Object.keys(salesMap).sort()
  let updatedRows = 0

  for (const dateStr of dates) {
    // daily_checks を取得（なければスキップ）
    const { data: check } = await db
      .from('daily_checks')
      .select('id')
      .eq('check_date', dateStr)
      .single()

    if (!check) continue

    for (const [productId, qty] of Object.entries(salesMap[dateStr])) {
      const { data: existing } = await db
        .from('inventory_records')
        .select('id')
        .eq('check_id', check.id)
        .eq('product_id', productId)
        .single()

      if (existing) {
        await db
          .from('inventory_records')
          .update({ sold_qty: qty })
          .eq('id', existing.id)
      } else {
        await db.from('inventory_records').insert({
          check_id: check.id,
          product_id: productId,
          sold_qty: qty,
          delivery_qty: 0,
          prev_stock: 0,
          prev_month_carry: 0,
          actual_stock: 0,
        })
      }
      updatedRows++
    }
  }

  return NextResponse.json({ ok: true, updatedRows, dates })
}
