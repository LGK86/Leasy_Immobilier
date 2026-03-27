import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    if (data.user) {
      const meta = data.user.user_metadata
      await supabase.from('profiles').upsert({
        id: data.user.id,
        first_name: meta.first_name ?? '',
        last_name: meta.last_name ?? '',
        email: data.user.email ?? '',
        updated_at: new Date().toISOString(),
      })
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
