import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// CSVフォーマット:
// 列0: 商品名
// 列1: 前回繰越数
// 列2〜N-4: 日付ごとの納品数（ヘッダー行に日付）
// 列N-3: 合計納品数（スキップ）
// 列N-2: 合計販売数（スキップ）
// 列N-1: 在庫数（スキップ）
// 最終行: 合計行（スキップ）
// 最終行+1: カメラ確認日時行

export async function POST(request: NextRequest) {
  const db = createServiceClient()
  const body = await request.json()
  const { year, month, csv } = body as { year: number; month: number; csv: string }

  const lines = csv.split('\n').map((l: string) => l.split(','))
  if (lines.length < 2) return NextResponse.json({ error: 'CSVが空です' }, { status: 400 })

  const headerRow = lines[0]
  // ヘッダー行から日付列を特定（列2以降、末尾3列を除く）
  const dateCols: { colIndex: number; dateStr: string }[] = []
  for (let i = 2; i < headerRow.length - 3; i++) {
    const cell = headerRow[i].trim()
    if (!cell) continue
    // "6/1" → "2026-06-01" に変換
    const match = cell.match(/^(\d+)\/(\d+)$/)
    if (!match) continue
    const m = match[1].padStart(2, '0')
    const d = match[2].padStart(2, '0')
    const dateStr = `${year}-${m}-${d}`
    // 重複日付は最初のものだけ使う
    if (!dateCols.find((dc) => dc.dateStr === dateStr)) {
      dateCols.push({ colIndex: i, dateStr })
    }
  }

  // カメラ確認日時行を探す（最後から2行目あたり）
  const cameraRow = lines[lines.length - 1].every((c: string) => !c.trim())
    ? lines[lines.length - 2]
    : lines[lines.length - 1]
  const cameraMap: Record<string, string> = {}
  for (const dc of dateCols) {
    const raw = cameraRow[dc.colIndex]?.trim()
    if (raw) cameraMap[dc.dateStr] = raw
  }

  // 商品名→IDのマップを取得
  const { data: products } = await db.from('products').select('id, name')
  const productMap: Record<string, string> = {}
  for (const p of products ?? []) productMap[p.name] = p.id

  // 日付ごとにdaily_checksをupsert
  const checkIdMap: Record<string, string> = {}
  for (const dc of dateCols) {
    const cameraAt = cameraMap[dc.dateStr] ? new Date(cameraMap[dc.dateStr]).toISOString() : null

    const { data: existing } = await db
      .from('daily_checks')
      .select('id')
      .eq('check_date', dc.dateStr)
      .single()

    if (existing) {
      await db.from('daily_checks').update({ camera_checked_at: cameraAt }).eq('id', existing.id)
      checkIdMap[dc.dateStr] = existing.id
    } else {
      const { data: inserted } = await db
        .from('daily_checks')
        .insert({ check_date: dc.dateStr, camera_checked_at: cameraAt })
        .select('id')
        .single()
      if (inserted) checkIdMap[dc.dateStr] = inserted.id
    }
  }

  // 商品行を処理（合計行・空行を除く）
  let importedRows = 0
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const row = lines[rowIdx]
    const productName = row[0]?.trim()
    if (!productName) continue
    // 合計行・カメラ確認行をスキップ
    if (!isNaN(Number(productName)) || productName === '') continue
    const productId = productMap[productName]
    if (!productId) continue

    const prevMonthCarry = Number(row[1]?.trim()) || 0

    for (const dc of dateCols) {
      const checkId = checkIdMap[dc.dateStr]
      if (!checkId) continue
      const deliveryQty = Number(row[dc.colIndex]?.trim()) || 0

      const { data: existing } = await db
        .from('inventory_records')
        .select('id')
        .eq('check_id', checkId)
        .eq('product_id', productId)
        .single()

      if (existing) {
        await db
          .from('inventory_records')
          .update({ delivery_qty: deliveryQty, prev_month_carry: prevMonthCarry })
          .eq('id', existing.id)
      } else {
        await db.from('inventory_records').insert({
          check_id: checkId,
          product_id: productId,
          delivery_qty: deliveryQty,
          prev_month_carry: prevMonthCarry,
          prev_stock: 0,
          sold_qty: 0,
          actual_stock: 0,
        })
      }
      importedRows++
    }
  }

  return NextResponse.json({ ok: true, importedRows, dates: dateCols.map((d) => d.dateStr) })
}
