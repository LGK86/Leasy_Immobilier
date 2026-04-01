export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    if (error) {
      console.error('[forgot-password] error:', error)
    }

    // Toujours retourner succès pour ne pas exposer l'existence du compte
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[forgot-password] unexpected:', err)
    return NextResponse.json({ success: true })
  }
}
