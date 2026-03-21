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

  if (sendEmail && doc.tenant?.email && process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from: 'Leasy Immobilier <onboarding@resend.dev>',
      to: doc.tenant.email,
      subject: `Document à signer : ${doc.title}`,
      html: `
        <p>Bonjour ${doc.tenant.first_name},</p>
        <p>Veuillez trouver ci-joint le document "${doc.title}" qui nécessite votre signature.</p>
        <p>Cordialement,<br/>${profile?.first_name} ${profile?.last_name}</p>
      `,
      attachments: [{
        filename: `${doc.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        content: Buffer.from(pdfBytes).toString('base64'),
      }],
    })
  }

  return NextResponse.json({ success: true, filePath: fileName })
}
