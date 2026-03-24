export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateDocumentPDF } from '@/lib/pdf/document'

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { token, signature } = await req.json()
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

  // Save tenant signature and finalize document
  const { error: updateErr } = await serviceClient
    .from('documents')
    .update({
      tenant_signature: signature,
      status: 'finalized',
      signing_token: null,
      signing_token_expires_at: null,
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', doc.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Generate final PDF with both signatures
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
      content: doc.content ?? {},
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

    // Send signed PDF to tenant + CC owner
    const recipients: string[] = []
    if (doc.tenant?.email) recipients.push(doc.tenant.email)
    if (recipients.length > 0) {
      await resend.emails.send({
        from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
        to: recipients,
        cc: owner?.email ? [owner.email] : undefined,
        subject: `Votre document signé - ${doc.title}`,
        html: `
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint votre document signé par les deux parties.</p>
          <p>Cordialement,<br/>Leasy Immobilier</p>
        `,
        attachments: [{
          filename: `${doc.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          content: Buffer.from(pdfBytes).toString('base64'),
        }],
      })
    }
  } catch { /* ignore PDF/email errors — signature is already saved */ }

  // Insert notification for owner
  try {
    await serviceClient.from('notifications').insert({
      user_id: doc.owner_id,
      type: 'document_signed',
      title: 'Bail signé par le locataire',
      body: `${doc.tenant?.first_name ?? ''} ${doc.tenant?.last_name ?? ''} a signé "${doc.title}"`.trim(),
      metadata: { document_id: doc.id },
    })
  } catch { /* ignore */ }

  return NextResponse.json({ success: true })
}
