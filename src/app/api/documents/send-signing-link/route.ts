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

  // Fetch document with primary tenant info and property
  const { data: doc, error: docErr } = await serviceSupabase
    .from('documents')
    .select('*, tenant:tenants(*), property:properties(*)')
    .eq('id', documentId)
    .eq('owner_id', user.id)
    .single()

  if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Determine all tenant IDs (multi-tenant support)
  const tenantIds: string[] = Array.isArray(doc.content?.tenant_ids) && doc.content.tenant_ids.length > 0
    ? doc.content.tenant_ids
    : (doc.tenant_id ? [doc.tenant_id] : [])

  if (tenantIds.length === 0) {
    return NextResponse.json({ error: 'No tenant found for this document' }, { status: 400 })
  }

  // Fetch all tenants
  const { data: tenants, error: tenantsErr } = await serviceSupabase
    .from('tenants')
    .select('id, first_name, last_name, email')
    .in('id', tenantIds)

  if (tenantsErr || !tenants || tenants.length === 0) {
    return NextResponse.json({ error: 'Tenants not found' }, { status: 400 })
  }

  const tenantsWithEmail = tenants.filter(t => !!t.email)
  if (tenantsWithEmail.length === 0) {
    return NextResponse.json({ error: 'No tenant email found' }, { status: 400 })
  }

  // Generate a single token with 7-day expiry
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

  const propertyAddress = doc.property ? `${doc.property.address}, ${doc.property.city}` : ''
  const baseSigningUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${token}`

  // Send one email per tenant
  for (const tenant of tenantsWithEmail) {
    const signingUrl = `${baseSigningUrl}?tid=${tenant.id}`
    const tenantName = `${tenant.first_name} ${tenant.last_name}`

    await resend.emails.send({
      from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
      to: tenant.email,
      subject: `Signature requise : ${doc.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #063B26; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #CFFF92; margin: 0; font-size: 20px;">Leasy Immobilier</h1>
          </div>
          <div style="padding: 32px; background: #ffffff; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Bonjour ${tenantName},</p>
            <p style="color: #374151;">Votre bailleur vous invite à signer le document suivant :</p>
            <p style="color: #063B26; font-weight: bold; font-size: 18px;">${doc.title}${propertyAddress ? ` — ${propertyAddress}` : ''}</p>
            <p style="color: #6b7280; font-size: 14px;">Cliquez sur le bouton ci-dessous pour consulter et signer votre document en ligne :</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${signingUrl}"
                 style="background-color: #CFFF92; color: #063B26; padding: 16px 32px;
                        border-radius: 8px; text-decoration: none; font-weight: bold;
                        font-size: 16px; display: inline-block;">
                ✍️ Signer le document
              </a>
            </div>
            <p style="color: #6b7280; font-size: 12px;">Ou copiez ce lien dans votre navigateur :</p>
            <p style="color: #063B26; font-size: 12px; word-break: break-all;">${signingUrl}</p>
            <p style="color: #6b7280; font-size: 12px;">Ce lien est valable 7 jours.</p>
          </div>
          <div style="background-color: #F5F6F4; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Leasy Immobilier — noreply@leasy-immo.fr</p>
          </div>
        </div>
      `,
    })
  }

  return NextResponse.json({ success: true })
}
