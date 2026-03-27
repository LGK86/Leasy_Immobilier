import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Passer upcoming → active si date d'entrée atteinte
  await supabase
    .from('tenants')
    .update({ status: 'active' })
    .eq('status', 'upcoming')
    .lte('entry_date', today)

  return NextResponse.json({ success: true })
}
