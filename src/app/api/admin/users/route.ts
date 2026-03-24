export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createCookieClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

async function isAdmin(userEmail: string): Promise<boolean> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('email', userEmail)
    .maybeSingle()
  return !!data
}

export async function PATCH(request: NextRequest) {
  const cookieClient = await createCookieClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await isAdmin(user.email!))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, blocked } = await request.json()
  if (!userId || typeof blocked !== 'boolean') {
    return NextResponse.json({ error: 'userId and blocked required' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ blocked, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
