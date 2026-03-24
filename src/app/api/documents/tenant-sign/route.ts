export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
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

  // Generate PDF
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: doc.id }),
  }).catch(() => {})

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

  // Email owner
  if (doc.owner?.email) {
    const tenantName = `${doc.tenant?.first_name ?? ''} ${doc.tenant?.last_name ?? ''}`.trim()
    await resend.emails.send({
      from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
      to: doc.owner.email,
      subject: `Document signé : ${doc.title}`,
      html: `
        <p>Bonjour,</p>
        <p>Le document <strong>${doc.title}</strong> a été signé par <strong>${tenantName}</strong>.</p>
        <p>Connectez-vous à votre espace Leasy Immobilier pour le télécharger.</p>
      `,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
