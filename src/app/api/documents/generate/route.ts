export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocumentPDF, generateInspectionPDF, generateInventoryPDF } from '@/lib/pdf/document'
import { closeExitInspection } from '@/lib/documents/close-exit-inspection'
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

  // Resolve all tenant IDs
  let tenantIds: string[] = []
  const rawTenantIds = doc.content?.tenant_ids
  if (Array.isArray(rawTenantIds)) {
    tenantIds = rawTenantIds
  } else if (typeof rawTenantIds === 'string' && rawTenantIds.length > 0) {
    tenantIds = rawTenantIds.split(',').map((id: string) => id.trim()).filter(Boolean)
  }
  if (tenantIds.length === 0 && doc.tenant_id) {
    tenantIds = [doc.tenant_id]
  }

  const { data: pdfTenants } = tenantIds.length > 0
    ? await supabase.from('tenants').select('id, first_name, last_name, email, phone').in('id', tenantIds)
    : { data: [] }

  const tenantSigsArr: Array<{ tenant_id: string; signature: string }> =
    Array.isArray(doc.content?.tenant_signatures) ? doc.content.tenant_signatures : []
  const tenants = (pdfTenants ?? []).map(t => ({
    name: `${t.first_name} ${t.last_name}`,
    email: t.email ?? undefined,
    phone: t.phone ?? undefined,
    signature: tenantSigsArr.find((s: any) => s.tenant_id === t.id)?.signature ?? doc.tenant_signature ?? null,
  }))

  const pdfData = {
    type: doc.type as 'lease' | 'entry_inspection' | 'exit_inspection' | 'inventory',
    title: doc.title,
    ownerName: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    ownerAddress: `${profile?.address ?? ''}, ${profile?.postal_code ?? ''} ${profile?.city ?? ''}`,
    ownerEmail: profile?.email ?? undefined,
    ownerPhone: profile?.phone ?? undefined,
    tenants,
    propertyAddress: doc.property?.address ?? '',
    propertyCity: doc.property?.city ?? '',
    propertyPostalCode: doc.property?.postal_code ?? '',
    propertyType: doc.property?.type,
    content: doc.content ?? {},
    ownerSignature: doc.owner_signature,
    date: doc.created_at,
  }

  let pdfBytes: Uint8Array
  if (doc.type === 'entry_inspection' || doc.type === 'exit_inspection') {
    pdfBytes = await generateInspectionPDF(pdfData)
  } else if (doc.type === 'inventory') {
    pdfBytes = await generateInventoryPDF(pdfData)
  } else {
    pdfBytes = await generateDocumentPDF(pdfData)
  }

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

  // Sync property surface/rooms_count from lease content
  if (doc.type === 'lease' && doc.property_id) {
    const surface = parseFloat(doc.content?.['Surface habitable'] || doc.content?.['Surface'] || '')
    const roomsCount = parseInt(doc.content?.['Nombre de pieces'] || '')
    const propUpdates: Record<string, unknown> = {}
    if (!isNaN(surface) && surface > 0) propUpdates.surface = surface
    if (!isNaN(roomsCount) && roomsCount > 0) propUpdates.rooms_count = roomsCount
    if (Object.keys(propUpdates).length > 0) {
      await supabase.from('properties').update(propUpdates).eq('id', doc.property_id)
    }
  }

  // Auto-close when an exit inspection is generated/finalized
  if (doc.type === 'exit_inspection') {
    await closeExitInspection(supabase, doc, user.id)
  }

  if (sendEmail && process.env.RESEND_API_KEY) {
    // Determine all tenant IDs (multi-tenant support)
    let tenantIds: string[] = []
    const rawTenantIds = doc.content?.tenant_ids
    if (Array.isArray(rawTenantIds)) {
      tenantIds = rawTenantIds
    } else if (typeof rawTenantIds === 'string' && rawTenantIds.length > 0) {
      tenantIds = rawTenantIds.split(',').map((id: string) => id.trim()).filter(Boolean)
    }
    if (tenantIds.length === 0 && doc.tenant_id) {
      tenantIds = [doc.tenant_id]
    }

    // Fetch all tenants in a single query
    const { data: allTenants } = await supabase
      .from('tenants')
      .select('id, first_name, last_name, email')
      .in('id', tenantIds)

    const tenantsWithEmail = (allTenants ?? []).filter(t => !!t.email)
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
