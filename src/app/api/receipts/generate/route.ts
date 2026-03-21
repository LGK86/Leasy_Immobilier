export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateReceiptPDF } from '@/lib/pdf/receipt'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { paymentId, sendEmail = false, propertyId, tenantId, periodMonth, periodYear } = body

    console.log('[receipt/generate] START | user:', user.id, '| property:', propertyId, '| tenant:', tenantId, '| period:', periodMonth, '/', periodYear)

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (profileError || !profile) {
      console.error('[receipt/generate] profile error:', profileError)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    console.log('[receipt/generate] profile OK:', profile.first_name, profile.last_name)

    // Get property & tenant
    const [{ data: property, error: propError }, { data: tenant, error: tenantError }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', propertyId).single(),
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
    ])

    if (propError || !property) {
      console.error('[receipt/generate] property error:', propError)
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
    if (tenantError || !tenant) {
      console.error('[receipt/generate] tenant error:', tenantError)
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }
    console.log('[receipt/generate] property OK:', property.address, '| tenant OK:', tenant.first_name, tenant.last_name)

    // Get or use payment data
    let rent = property.monthly_rent
    let charges = property.charges
    if (paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from('rent_payments').select('*').eq('id', paymentId).single()
      if (paymentError) console.warn('[receipt/generate] payment fetch warning:', paymentError)
      if (payment) {
        rent = payment.amount
        charges = payment.charges
        console.log('[receipt/generate] payment found, using amount:', rent, 'charges:', charges)
      }
    }

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
        rent: Number(rent),
        charges: Number(charges),
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        issueDate: new Date().toISOString().split('T')[0],
      })
      console.log('[receipt/generate] PDF generated, size:', pdfBytes.length, 'bytes')
    } catch (pdfError) {
      console.error('[receipt/generate] PDF generation error:', pdfError)
      return NextResponse.json({ error: 'PDF generation failed', detail: String(pdfError) }, { status: 500 })
    }

    // Upload to Supabase Storage
    const fileName = `${user.id}/receipts/${propertyId}/${tenantId}_${periodYear}_${String(periodMonth).padStart(2, '0')}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('[receipt/generate] upload error:', JSON.stringify(uploadError))
      return NextResponse.json({ error: 'Upload failed', detail: uploadError.message }, { status: 500 })
    }
    console.log('[receipt/generate] uploaded to:', fileName)

    // Save receipt — check for existing record first to avoid upsert constraint issues
    const { data: existing } = await supabase
      .from('rent_receipts')
      .select('id')
      .eq('owner_id', user.id)
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId)
      .eq('period_month', Number(periodMonth))
      .eq('period_year', Number(periodYear))
      .single()

    const receiptPayload = {
      owner_id: user.id,
      property_id: propertyId,
      tenant_id: tenantId,
      payment_id: paymentId ?? null,
      period_month: Number(periodMonth),
      period_year: Number(periodYear),
      amount: Number(rent),
      charges: Number(charges),
      issue_date: new Date().toISOString().split('T')[0],
      file_path: fileName,
      sent_at: sendEmail ? new Date().toISOString() : (existing ? undefined : null),
    }

    let receiptId: string | undefined
    if (existing) {
      console.log('[receipt/generate] updating existing receipt:', existing.id)
      const { data, error } = await supabase
        .from('rent_receipts')
        .update(receiptPayload)
        .eq('id', existing.id)
        .select('id')
        .single()
      if (error) {
        console.error('[receipt/generate] receipt update error:', JSON.stringify(error))
        return NextResponse.json({ error: 'Failed to save receipt record', detail: error.message }, { status: 500 })
      }
      receiptId = data?.id
    } else {
      console.log('[receipt/generate] inserting new receipt record')
      const { data, error } = await supabase
        .from('rent_receipts')
        .insert(receiptPayload)
        .select('id')
        .single()
      if (error) {
        console.error('[receipt/generate] receipt insert error:', JSON.stringify(error))
        return NextResponse.json({ error: 'Failed to save receipt record', detail: error.message }, { status: 500 })
      }
      receiptId = data?.id
    }

    console.log('[receipt/generate] receipt saved, id:', receiptId)

    // Invalidate receipts page cache so router.refresh() sees fresh data
    revalidatePath('/receipts')

    // Send email if requested
    let emailSent = false
    let emailError: string | undefined

    if (sendEmail) {
      if (!tenant.email) {
        emailError = 'Le locataire n\'a pas d\'adresse email.'
        console.warn('[receipt/generate] email skipped: tenant has no email')
      } else if (!process.env.RESEND_API_KEY) {
        emailError = 'RESEND_API_KEY manquante.'
        console.warn('[receipt/generate] email skipped: RESEND_API_KEY not set')
      } else {
        const MONTHS_FR = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre']
        const monthLabel = MONTHS_FR[Number(periodMonth) - 1] ?? String(periodMonth)
        console.log('[receipt/generate] sending email to:', tenant.email)
        try {
          const { data: emailData, error: resendError } = await resend.emails.send({
            from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
            to: tenant.email,
            subject: `Quittance de loyer - ${monthLabel} ${periodYear}`,
            html: `
              <p>Bonjour ${tenant.first_name} ${tenant.last_name},</p>
              <p>Veuillez trouver ci-joint votre quittance de loyer pour le mois de <strong>${monthLabel} ${periodYear}</strong>.</p>
              <p>Montant total : <strong>${(Number(rent) + Number(charges)).toFixed(2)} EUR</strong></p>
              <p>Cordialement,<br/>${profile.first_name ?? ''} ${profile.last_name ?? ''}</p>
            `,
            attachments: [{
              filename: `quittance_${periodYear}_${String(periodMonth).padStart(2, '0')}.pdf`,
              content: Buffer.from(pdfBytes).toString('base64'),
            }],
          })
          if (resendError) {
            emailError = resendError.message
            console.error('[receipt/generate] resend error:', JSON.stringify(resendError))
          } else {
            emailSent = true
            console.log('[receipt/generate] email sent, id:', emailData?.id, '→', tenant.email)
          }
        } catch (err) {
          emailError = String(err)
          console.error('[receipt/generate] email exception:', err)
        }
      }
    }

    console.log('[receipt/generate] DONE | receiptId:', receiptId, '| emailSent:', emailSent)
    return NextResponse.json({ success: true, filePath: fileName, receiptId, emailSent, emailError })
  } catch (err) {
    console.error('[receipt/generate] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}
