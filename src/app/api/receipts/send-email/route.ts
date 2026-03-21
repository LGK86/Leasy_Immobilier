export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const MONTHS_FR = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

export async function POST(request: NextRequest) {
  console.log('[send-email] route called')

  const apiKey = process.env.RESEND_API_KEY
  console.log('[send-email] RESEND_API_KEY set:', !!apiKey, '| starts with re_:', apiKey?.startsWith('re_'))

  if (!apiKey) {
    console.error('[send-email] RESEND_API_KEY is not set')
    return NextResponse.json({ error: 'RESEND_API_KEY non configurée sur le serveur' }, { status: 500 })
  }

  const resend = new Resend(apiKey)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const { receiptId } = body

    if (!receiptId) {
      return NextResponse.json({ error: 'receiptId manquant' }, { status: 400 })
    }

    console.log('[send-email] fetching receipt:', receiptId)

    // Fetch receipt with all related data
    const { data: receipt, error: receiptError } = await supabase
      .from('rent_receipts')
      .select('*, property:properties(address, city, postal_code), tenant:tenants(first_name, last_name, email)')
      .eq('id', receiptId)
      .eq('owner_id', user.id)
      .single()

    if (receiptError || !receipt) {
      console.error('[send-email] receipt fetch error:', receiptError)
      return NextResponse.json({ error: 'Quittance introuvable' }, { status: 404 })
    }

    console.log('[send-email] receipt OK | tenant email:', receipt.tenant?.email, '| file_path:', receipt.file_path)

    if (!receipt.tenant?.email) {
      return NextResponse.json({ error: 'Le locataire n\'a pas d\'adresse email' }, { status: 400 })
    }

    if (!receipt.file_path) {
      return NextResponse.json({ error: 'Aucun PDF associé à cette quittance. Régénérez la quittance d\'abord.' }, { status: 400 })
    }

    // Download existing PDF from storage
    console.log('[send-email] downloading PDF:', receipt.file_path)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(receipt.file_path)

    if (downloadError || !fileData) {
      console.error('[send-email] download error:', downloadError)
      return NextResponse.json({ error: 'Impossible de télécharger le PDF depuis le stockage', detail: downloadError?.message }, { status: 500 })
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    console.log('[send-email] PDF downloaded, size:', pdfBuffer.length, 'bytes')

    // Fetch owner profile for signature
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    const monthLabel = MONTHS_FR[receipt.period_month - 1] ?? String(receipt.period_month)
    const tenantName = `${receipt.tenant.first_name} ${receipt.tenant.last_name}`
    const ownerName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : ''
    const total = (Number(receipt.amount) + Number(receipt.charges)).toFixed(2)

    console.log('[send-email] sending to:', receipt.tenant.email, '| subject: Quittance', monthLabel, receipt.period_year)

    const { data: emailData, error: resendError } = await resend.emails.send({
      from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
      to: receipt.tenant.email,
      subject: `Quittance de loyer - ${monthLabel} ${receipt.period_year}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #063B26;">Quittance de loyer</h2>
          <p>Bonjour ${tenantName},</p>
          <p>Veuillez trouver ci-joint votre quittance de loyer pour le mois de <strong>${monthLabel} ${receipt.period_year}</strong>.</p>
          <p>Montant total : <strong>${total} EUR</strong></p>
          ${ownerName ? `<p>Cordialement,<br/>${ownerName}</p>` : ''}
        </div>
      `,
      attachments: [{
        filename: `quittance_${receipt.period_year}_${String(receipt.period_month).padStart(2, '0')}.pdf`,
        content: pdfBuffer.toString('base64'),
      }],
    })

    if (resendError) {
      console.error('[send-email] resend error:', JSON.stringify(resendError))
      return NextResponse.json({ error: 'Resend a refusé l\'envoi', detail: resendError.message }, { status: 500 })
    }

    console.log('[send-email] email sent! id:', emailData?.id, '→', receipt.tenant.email)

    // Update sent_at in DB
    await supabase
      .from('rent_receipts')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', receiptId)

    return NextResponse.json({ success: true, emailId: emailData?.id, sentTo: receipt.tenant.email })
  } catch (err) {
    console.error('[send-email] unhandled error:', err)
    return NextResponse.json({ error: 'Erreur interne', detail: String(err) }, { status: 500 })
  }
}
