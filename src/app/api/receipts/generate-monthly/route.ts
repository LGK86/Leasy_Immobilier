export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateReceiptPDF } from '@/lib/pdf/receipt'

const MONTHS_FR = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre']

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role client — bypasses RLS to access all users' data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthLabel = MONTHS_FR[month - 1]

  // Get all tenants whose property is rented
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*, property:properties(*)')
    .not('property_id', 'is', null)

  if (tenantsError) {
    console.error('[cron/receipts] tenants fetch error:', tenantsError)
    return NextResponse.json({ error: tenantsError.message }, { status: 500 })
  }

  const rentedTenants = (tenants ?? []).filter(
    (t: any) => t.property?.status === 'rented'
  )

  let created = 0
  let skipped = 0

  // Track which owner_ids got new receipts for notifications
  const ownerCreatedCount: Record<string, number> = {}

  for (const tenant of rentedTenants) {
    const property = tenant.property
    if (!property) { skipped++; continue }

    // Check if receipt already exists for this month/year
    const { data: existing } = await supabase
      .from('rent_receipts')
      .select('id')
      .eq('owner_id', tenant.owner_id)
      .eq('property_id', tenant.property_id)
      .eq('tenant_id', tenant.id)
      .eq('period_month', month)
      .eq('period_year', year)
      .maybeSingle()

    if (existing) { skipped++; continue }

    // Get owner profile for PDF
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', tenant.owner_id)
      .single()

    if (!profile) { skipped++; continue }

    // Generate PDF
    let pdfBytes: Uint8Array
    try {
      pdfBytes = await generateReceiptPDF({
        ownerFirstName: profile.first_name ?? '',
        ownerLastName: profile.last_name ?? '',
        ownerAddress: profile.address ?? '',
        ownerCity: profile.city ?? '',
        ownerPostalCode: profile.postal_code ?? '',
        tenantFirstName: tenant.first_name,
        tenantLastName: tenant.last_name,
        propertyAddress: property.address,
        propertyCity: property.city,
        propertyPostalCode: property.postal_code,
        rent: Number(property.monthly_rent),
        charges: Number(property.charges),
        periodMonth: month,
        periodYear: year,
        issueDate: new Date().toISOString().split('T')[0],
      })
    } catch (pdfError) {
      console.error('[cron/receipts] PDF error for tenant', tenant.id, ':', pdfError)
      skipped++
      continue
    }

    // Upload to Storage
    const fileName = `${tenant.owner_id}/receipts/${tenant.property_id}/${tenant.id}_${year}_${String(month).padStart(2, '0')}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('[cron/receipts] upload error for tenant', tenant.id, ':', uploadError.message)
      skipped++
      continue
    }

    // Check if a paid payment exists for this period — link it if so
    const { data: paidPayment } = await supabase
      .from('rent_payments')
      .select('id')
      .eq('owner_id', tenant.owner_id)
      .eq('property_id', tenant.property_id)
      .eq('tenant_id', tenant.id)
      .eq('period_month', month)
      .eq('period_year', year)
      .eq('status', 'paid')
      .maybeSingle()

    // Insert receipt record
    const { error: insertError } = await supabase.from('rent_receipts').insert({
      owner_id: tenant.owner_id,
      property_id: tenant.property_id,
      tenant_id: tenant.id,
      payment_id: paidPayment?.id ?? null,
      period_month: month,
      period_year: year,
      amount: Number(property.monthly_rent),
      charges: Number(property.charges),
      issue_date: new Date().toISOString().split('T')[0],
      file_path: fileName,
      sent_at: null,
    })

    if (insertError) {
      console.error('[cron/receipts] insert error for tenant', tenant.id, ':', insertError.message)
      skipped++
      continue
    }

    created++
    ownerCreatedCount[tenant.owner_id] = (ownerCreatedCount[tenant.owner_id] ?? 0) + 1
    console.log('[cron/receipts] created receipt for tenant', tenant.id, '| file:', fileName)
  }

  // Insert a notification for each owner who got new receipts
  for (const [ownerId, count] of Object.entries(ownerCreatedCount)) {
    await supabase.from('notifications').insert({
      owner_id: ownerId,
      type: 'receipts_generated',
      title: 'Quittances générées',
      message: `${count} quittance(s) générée(s) pour ${monthLabel} ${year}`,
    })
  }

  console.log('[cron/receipts] DONE | created:', created, '| skipped:', skipped)
  return NextResponse.json({ success: true, created, skipped, month, year })
}
