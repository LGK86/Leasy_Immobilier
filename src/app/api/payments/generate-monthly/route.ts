export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // Get all active tenants with a property
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*, property:properties(*)')
    .eq('status', 'active')
    .not('property_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let created = 0
  let skipped = 0

  for (const tenant of tenants ?? []) {
    if (!tenant.property) continue

    // Check if payment already exists for this period
    const { data: existing } = await supabase
      .from('rent_payments')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('property_id', tenant.property_id)
      .eq('period_month', month)
      .eq('period_year', year)
      .single()

    if (existing) { skipped++; continue }

    await supabase.from('rent_payments').insert({
      owner_id: tenant.owner_id,
      property_id: tenant.property_id,
      tenant_id: tenant.id,
      amount: tenant.property.monthly_rent,
      charges: tenant.property.charges,
      period_month: month,
      period_year: year,
      status: 'pending_validation',
    })
    created++
  }

  return NextResponse.json({ success: true, created, skipped, month, year })
}
