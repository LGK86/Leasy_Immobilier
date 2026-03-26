export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateDocumentPDF } from '@/lib/pdf/document'

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
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  if (doc.status === 'finalized') {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  }

  // Determine all tenant IDs
  const allTenantIds: string[] = Array.isArray(doc.content?.tenant_ids) && doc.content.tenant_ids.length > 0
    ? doc.content.tenant_ids
    : (doc.tenant_id ? [doc.tenant_id] : [])

  // Identify the signing tenant
  const signingTenantId: string = tenantId ?? doc.tenant_id

  // Update tenant_signatures map
  const currentSignatures: Record<string, string> = doc.content?.tenant_signatures ?? {}
  const newSignatures = { ...currentSignatures, [signingTenantId]: signature }

  // Check if all tenants have now signed
  const allSigned = allTenantIds.length > 0 && allTenantIds.every(id => newSignatures[id])

  const updatedContent = { ...(doc.content ?? {}), tenant_signatures: newSignatures }

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

    // Generate final PDF with both signatures and send to all tenants
    try {
      const owner = doc.owner
      const pdfBytes = await generateDocumentPDF({
        type: doc.type,
        title: doc.title,
        ownerName: `${owner?.first_name ?? ''} ${owner?.last_name ?? ''}`.trim(),
        ownerAddress: `${owner?.address ?? ''}, ${owner?.postal_code ?? ''} ${owner?.city ?? ''}`,
        tenantName: doc.tenant ? `${doc.tenant.first_name} ${doc.tenant.last_name}` : '',
        propertyAddress: doc.property?.address ?? '',
        propertyCity: doc.property?.city ?? '',
        propertyPostalCode: doc.property?.postal_code ?? '',
        content: updatedContent,
        ownerSignature: doc.owner_signature,
        tenantSignature: signature,
        date: doc.created_at,
      })

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

      const signedCount = Object.keys(newSignatures).length
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
