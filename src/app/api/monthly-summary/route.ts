import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 })
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`
  const endDate = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)

  const { data: checks, error: checksError } = await db
    .from('daily_checks')
    .select('id, check_date, camera_checked_at')
    .gte('check_date', startDate)
    .lte('check_date', endDate)
    .order('check_date', { ascending: true })

  if (checksError) return NextResponse.json({ error: checksError.message }, { status: 500 })

  if (!checks || checks.length === 0) {
    return NextResponse.json({ checks: [], records: [] })
  }

  const checkIds = checks.map((c) => c.id)

  const { data: records, error: recordsError } = await db
    .from('inventory_records')
    .select('*, products(name, sort_order)')
    .in('check_id', checkIds)

  if (recordsError) return NextResponse.json({ error: recordsError.message }, { status: 500 })

  return NextResponse.json({ checks, records: records ?? [] })
}
