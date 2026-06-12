import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set('auth_token', process.env.AUTH_TOKEN_VALUE!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
