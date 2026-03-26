export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocumentPDF } from '@/lib/pdf/document'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { documentId, sendEmail = false } = body

  const { data: doc } = await supabase
    .from('documents')
    .select('*, property:properties(*), tenant:tenants(*)')
    .eq('id', documentId)
    .eq('owner_id', user.id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const pdfBytes = await generateDocumentPDF({
    type: doc.type,
    title: doc.title,
    ownerName: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    ownerAddress: `${profile?.address ?? ''}, ${profile?.postal_code ?? ''} ${profile?.city ?? ''}`,
    tenantName: doc.tenant ? `${doc.tenant.first_name} ${doc.tenant.last_name}` : '',
    propertyAddress: doc.property?.address ?? '',
    propertyCity: doc.property?.city ?? '',
    propertyPostalCode: doc.property?.postal_code ?? '',
    content: doc.content ?? {},
    ownerSignature: doc.owner_signature,
    tenantSignature: doc.tenant_signature,
    date: doc.created_at,
  })

  const fileName = `${user.id}/documents/${doc.id}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const updates: Record<string, unknown> = {
    file_path: fileName,
    updated_at: new Date().toISOString(),
  }

  if (doc.owner_signature && doc.tenant_signature) {
    updates.status = 'finalized'
    updates.signed_at = new Date().toISOString()
  }

  if (sendEmail) {
    updates.sent_at = new Date().toISOString()
    if (doc.status === 'draft') updates.status = 'sent'
  }

  await supabase.from('documents').update(updates).eq('id', documentId)

  if (sendEmail && process.env.RESEND_API_KEY) {
    // Determine all tenant IDs (multi-tenant support)
    const tenantIds: string[] = Array.isArray(doc.content?.tenant_ids) && doc.content.tenant_ids.length > 0
      ? doc.content.tenant_ids
      : (doc.tenant_id ? [doc.tenant_id] : [])

    // Fetch all tenants if multi-tenant, otherwise use the already-joined tenant
    let allTenants: { id: string; first_name: string; last_name: string; email: string | null }[] = []
    if (tenantIds.length > 1) {
      const { data: fetchedTenants } = await supabase
        .from('tenants')
        .select('id, first_name, last_name, email')
        .in('id', tenantIds)
      allTenants = fetchedTenants ?? []
    } else if (doc.tenant) {
      allTenants = [doc.tenant]
    }

    const tenantsWithEmail = allTenants.filter(t => !!t.email)
    const pdfAttachment = {
      filename: `${doc.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      content: Buffer.from(pdfBytes).toString('base64'),
    }

    if (tenantsWithEmail.length > 0) {
      for (const tenant of tenantsWithEmail) {
        await resend.emails.send({
          from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
          to: tenant.email!,
          cc: profile?.email ? [profile.email] : undefined,
          subject: `Document signé - ${doc.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #063B26; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: #CFFF92; margin: 0; font-size: 20px;">Leasy Immobilier</h1>
              </div>
              <div style="padding: 32px; background: #ffffff; border: 1px solid #e5e7eb;">
                <p style="color: #374151; font-size: 16px;">Bonjour ${tenant.first_name},</p>
                <p style="color: #374151;">Veuillez trouver ci-joint le document <strong>${doc.title}</strong>, signé par les deux parties.</p>
                <p style="color: #374151;">Conservez ce document pour vos archives.</p>
                <p style="color: #374151;">Cordialement,<br/>Leasy Immobilier</p>
              </div>
              <div style="background-color: #F5F6F4; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">Leasy Immobilier — noreply@leasy-immo.fr</p>
              </div>
            </div>
          `,
          attachments: [pdfAttachment],
        })
      }
    } else if (profile?.email) {
      // No tenants with email: send to owner only
      await resend.emails.send({
        from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
        to: profile.email,
        subject: `Document signé - ${doc.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #063B26; padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #CFFF92; margin: 0; font-size: 20px;">Leasy Immobilier</h1>
            </div>
            <div style="padding: 32px; background: #ffffff; border: 1px solid #e5e7eb;">
              <p style="color: #374151; font-size: 16px;">Bonjour,</p>
              <p style="color: #374151;">Veuillez trouver ci-joint le document <strong>${doc.title}</strong>, signé par les deux parties.</p>
              <p style="color: #374151;">Conservez ce document pour vos archives.</p>
              <p style="color: #374151;">Cordialement,<br/>Leasy Immobilier</p>
            </div>
            <div style="background-color: #F5F6F4; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Leasy Immobilier — noreply@leasy-immo.fr</p>
            </div>
          </div>
        `,
        attachments: [pdfAttachment],
      })
    }
  }

  return NextResponse.json({ success: true, filePath: fileName })
}
