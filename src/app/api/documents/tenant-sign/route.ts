export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateDocumentPDF, generateInspectionPDF, generateInventoryPDF } from '@/lib/pdf/document'

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { token, signature, tenantId } = await req.json()
  if (!token || !signature) {
    return NextResponse.json({ error: 'Missing token or signature' }, { status: 400 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: doc, error: docErr } = await serviceClient
    .from('documents')
    .select('*, tenant:tenants(*), property:properties(*), owner:profiles!owner_id(*)')
    .eq('signing_token', token)
    .single()

  if (docErr || !doc) {
    console.error('[tenant-sign] Token validation error:', { token: token?.slice(0, 8) + '...', tenantId, error: docErr?.message })
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }
  console.log('[tenant-sign] Document found:', { id: doc.id, type: doc.type, status: doc.status })

  if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  if (doc.status === 'finalized') {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  }

  // Determine all tenant IDs
  let allTenantIds: string[] = []
  const rawTenantIds = doc.content?.tenant_ids
  if (Array.isArray(rawTenantIds)) {
    allTenantIds = rawTenantIds
  } else if (typeof rawTenantIds === 'string' && rawTenantIds.length > 0) {
    allTenantIds = rawTenantIds.split(',').map((id: string) => id.trim()).filter(Boolean)
  }
  if (allTenantIds.length === 0 && doc.tenant_id) {
    allTenantIds = [doc.tenant_id]
  }

  // Identify the signing tenant
  const signingTenantId: string = tenantId ?? doc.tenant_id

  // Update tenant_signatures array
  const currentSigs: Array<{ tenant_id: string; signature: string; signed_at: string }> =
    Array.isArray(doc.content?.tenant_signatures) ? [...doc.content.tenant_signatures] : []
  if (!currentSigs.some((s: any) => s.tenant_id === signingTenantId)) {
    currentSigs.push({
      tenant_id: signingTenantId,
      signature,
      signed_at: new Date().toISOString().split('T')[0],
    })
  }

  // Check if all tenants have now signed
  const allSigned = allTenantIds.length > 0 && allTenantIds.every((id: string) => currentSigs.some((s: any) => s.tenant_id === id))

  const updatedContent = { ...(doc.content ?? {}), tenant_signatures: currentSigs }

  if (allSigned) {
    // Finalize document
    const { error: updateErr } = await serviceClient
      .from('documents')
      .update({
        tenant_signature: signature,
        content: updatedContent,
        status: 'finalized',
        signing_token: null,
        signing_token_expires_at: null,
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Update all tenants to active status
    if (allTenantIds.length > 0) {
      await serviceClient.from('tenants').update({ status: 'active' }).in('id', allTenantIds)
    }

    // Generate final PDF with both signatures and send to all tenants
    try {
      const owner = doc.owner

      // Fetch all tenants for PDF
      const { data: pdfTenants } = await serviceClient
        .from('tenants')
        .select('id, first_name, last_name')
        .in('id', allTenantIds)

      const tenants = (pdfTenants ?? []).map(t => ({
        name: `${t.first_name} ${t.last_name}`,
        signature: currentSigs.find((s: any) => s.tenant_id === t.id)?.signature ?? null,
      }))

      const pdfInput = {
        type: doc.type as 'lease' | 'entry_inspection' | 'exit_inspection' | 'inventory',
        title: doc.title,
        ownerName: `${owner?.first_name ?? ''} ${owner?.last_name ?? ''}`.trim(),
        ownerAddress: `${owner?.address ?? ''}, ${owner?.postal_code ?? ''} ${owner?.city ?? ''}`,
        ownerEmail: owner?.email ?? undefined,
        ownerPhone: owner?.phone ?? undefined,
        tenants,
        propertyAddress: doc.property?.address ?? '',
        propertyCity: doc.property?.city ?? '',
        propertyPostalCode: doc.property?.postal_code ?? '',
        propertyType: doc.property?.type,
        content: updatedContent,
        ownerSignature: doc.owner_signature,
        date: doc.created_at,
      }

      let pdfBytes: Uint8Array
      if (doc.type === 'entry_inspection' || doc.type === 'exit_inspection') {
        pdfBytes = await generateInspectionPDF(pdfInput)
      } else if (doc.type === 'inventory') {
        pdfBytes = await generateInventoryPDF(pdfInput)
      } else {
        pdfBytes = await generateDocumentPDF(pdfInput)
      }

      const fileName = `${doc.owner_id}/documents/${doc.id}.pdf`
      await serviceClient.storage
        .from('documents')
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

      await serviceClient
        .from('documents')
        .update({ file_path: fileName, updated_at: new Date().toISOString() })
        .eq('id', doc.id)

      // Fetch all tenants to send to
      const { data: allTenants } = await serviceClient
        .from('tenants')
        .select('id, first_name, last_name, email')
        .in('id', allTenantIds)

      const tenantsWithEmail = (allTenants ?? []).filter(t => !!t.email)
      const pdfAttachment = {
        filename: `${doc.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        content: Buffer.from(pdfBytes).toString('base64'),
      }

      for (const tenant of tenantsWithEmail) {
        await resend.emails.send({
          from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
          to: tenant.email,
          cc: owner?.email ? [owner.email] : undefined,
          subject: `Votre document signé - ${doc.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #063B26; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: #CFFF92; margin: 0; font-size: 20px;">Leasy Immobilier</h1>
              </div>
              <div style="padding: 32px; background: #ffffff; border: 1px solid #e5e7eb;">
                <p style="color: #374151; font-size: 16px;">Bonjour ${tenant.first_name},</p>
                <p style="color: #374151;">Veuillez trouver ci-joint votre document <strong>${doc.title}</strong>, signé par toutes les parties.</p>
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
    } catch { /* ignore PDF/email errors — signature is already saved */ }

    // Notify owner that document is fully signed
    try {
      await serviceClient.from('notifications').insert({
        user_id: doc.owner_id,
        type: 'document_signed',
        title: 'Bail signé — toutes les parties',
        body: `"${doc.title}" a été signé par tous les locataires.`,
        metadata: { document_id: doc.id },
      })
    } catch { /* ignore */ }

  } else {
    // Partial signing — update signatures but keep pending status
    const { error: updateErr } = await serviceClient
      .from('documents')
      .update({
        content: updatedContent,
        status: 'pending_tenant_signature',
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Notify owner that one tenant signed but others are pending
    try {
      const { data: signingTenantData } = await serviceClient
        .from('tenants')
        .select('first_name, last_name')
        .eq('id', signingTenantId)
        .single()

      const signedCount = currentSigs.length
      const totalCount = allTenantIds.length
      const tenantFullName = signingTenantData
        ? `${signingTenantData.first_name} ${signingTenantData.last_name}`
        : 'Un locataire'

      await serviceClient.from('notifications').insert({
        user_id: doc.owner_id,
        type: 'document_signed',
        title: 'Signature partielle du bail',
        body: `${tenantFullName} a signé "${doc.title}" (${signedCount}/${totalCount} locataires).`,
        metadata: { document_id: doc.id },
      })
    } catch { /* ignore */ }
  }

  return NextResponse.json({ success: true, finalized: allSigned })
}
