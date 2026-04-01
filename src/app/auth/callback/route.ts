export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Upsert du profil uniquement pour les nouvelles inscriptions (pas pour le reset)
      if (data.user && next === '/dashboard') {
        const meta = data.user.user_metadata
        await supabase.from('profiles').upsert({
          id: data.user.id,
          first_name: meta.first_name ?? '',
          last_name: meta.last_name ?? '',
          email: data.user.email ?? '',
          updated_at: new Date().toISOString(),
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
