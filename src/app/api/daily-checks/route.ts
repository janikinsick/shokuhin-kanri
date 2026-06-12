import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (date) {
    const { data, error } = await db
      .from('daily_checks')
      .select('*')
      .eq('check_date', date)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? null)
  }

  const { data, error } = await db
    .from('daily_checks')
    .select('*')
    .order('check_date', { ascending: false })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const db = createServiceClient()
  const body = await request.json()

  const { data: existing } = await db
    .from('daily_checks')
    .select('id')
    .eq('check_date', body.check_date)
    .single()

  if (existing) {
    const { data, error } = await db
      .from('daily_checks')
      .update({
        camera_checked_at: body.camera_checked_at ?? null,
        memo: body.memo ?? null,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await db
    .from('daily_checks')
    .insert({
      check_date: body.check_date,
      camera_checked_at: body.camera_checked_at ?? null,
      memo: body.memo ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
