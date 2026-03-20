import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateReceiptPDF } from '@/lib/pdf/receipt'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { paymentId, sendEmail = false, propertyId, tenantId, periodMonth, periodYear } = body

  // Get profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Get property & tenant
  const [{ data: property }, { data: tenant }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).single(),
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
  ])

  if (!property || !tenant) return NextResponse.json({ error: 'Property or tenant not found' }, { status: 404 })

  // Get or use payment data
  let rent = property.monthly_rent
  let charges = property.charges
  if (paymentId) {
    const { data: payment } = await supabase.from('rent_payments').select('*').eq('id', paymentId).single()
    if (payment) { rent = payment.amount; charges = payment.charges }
  }

  // Generate PDF
  const pdfBytes = await generateReceiptPDF({
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
    rent: Number(rent),
    charges: Number(charges),
    periodMonth,
    periodYear,
    issueDate: new Date().toISOString().split('T')[0],
  })

  // Upload to Supabase Storage
  const fileName = `${user.id}/receipts/${propertyId}/${tenantId}_${periodYear}_${String(periodMonth).padStart(2, '0')}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Save receipt record
  const { data: receipt, error: receiptError } = await supabase.from('rent_receipts').upsert({
    owner_id: user.id,
    property_id: propertyId,
    tenant_id: tenantId,
    payment_id: paymentId ?? null,
    period_month: periodMonth,
    period_year: periodYear,
    amount: Number(rent),
    charges: Number(charges),
    issue_date: new Date().toISOString().split('T')[0],
    file_path: fileName,
    sent_at: sendEmail ? new Date().toISOString() : null,
  }, {
    onConflict: 'owner_id,property_id,tenant_id,period_month,period_year',
    ignoreDuplicates: false,
  }).select().single()

  if (receiptError) {
    console.error('Receipt DB error:', receiptError)
  }

  // Send email if requested
  if (sendEmail && tenant.email && process.env.RESEND_API_KEY !== 're_placeholder_add_your_resend_api_key_here') {
    const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
    await resend.emails.send({
      from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
      to: tenant.email,
      subject: `Quittance de loyer - ${MONTHS_FR[periodMonth - 1]} ${periodYear}`,
      html: `
        <p>Bonjour ${tenant.first_name} ${tenant.last_name},</p>
        <p>Veuillez trouver ci-joint votre quittance de loyer pour le mois de ${MONTHS_FR[periodMonth - 1]} ${periodYear}.</p>
        <p>Montant total : <strong>${(Number(rent) + Number(charges)).toLocaleString('fr-FR')} €</strong></p>
        <p>Cordialement,<br/>${profile.first_name} ${profile.last_name}</p>
      `,
      attachments: [{
        filename: `quittance_${periodYear}_${String(periodMonth).padStart(2, '0')}.pdf`,
        content: Buffer.from(pdfBytes).toString('base64'),
      }],
    })
  }

  return NextResponse.json({ success: true, filePath: fileName, receiptId: receipt?.id })
}
