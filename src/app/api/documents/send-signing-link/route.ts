export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = await req.json()
  if (!documentId) return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // Fetch document with tenant info
  const { data: doc, error: docErr } = await serviceSupabase
    .from('documents')
    .select('*, tenant:tenants(*), property:properties(*)')
    .eq('id', documentId)
    .eq('owner_id', user.id)
    .single()

  if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  if (!doc.tenant?.email) {
    return NextResponse.json({ error: 'No tenant email found' }, { status: 400 })
  }

  // Generate token with 7-day expiry
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateErr } = await serviceSupabase
    .from('documents')
    .update({
      signing_token: token,
      signing_token_expires_at: expiresAt,
      status: 'pending_tenant_signature',
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const signingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${token}`
  const tenantName = `${doc.tenant.first_name} ${doc.tenant.last_name}`
  const propertyAddress = doc.property ? `${doc.property.address}, ${doc.property.city}` : ''

  const { error: emailErr } = await resend.emails.send({
    from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
    to: doc.tenant.email,
    subject: `Signature requise : ${doc.title}`,
    html: `
      <p>Bonjour ${tenantName},</p>
      <p>Votre bailleur vous invite à signer le document suivant :</p>
      <p><strong>${doc.title}</strong>${propertyAddress ? ` — ${propertyAddress}` : ''}</p>
      <p>
        <a href="${signingUrl}" style="display:inline-block;background:#CFFF92;color:#063B26;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Signer le document
        </a>
      </p>
      <p style="color:#888;font-size:12px;">Ce lien expire dans 7 jours.</p>
    `,
  })

  if (emailErr) return NextResponse.json({ error: emailErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
