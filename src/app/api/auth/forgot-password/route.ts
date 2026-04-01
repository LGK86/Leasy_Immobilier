export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      },
    })

    if (error || !data?.properties?.action_link) {
      console.error('[forgot-password] generateLink error:', error)
      return NextResponse.json({ success: true })
    }

    const resetLink = data.properties.action_link

    await resend.emails.send({
      from: 'Leasy Immobilier <noreply@leasy-immo.fr>',
      to: email,
      subject: 'Reinitialisation de votre mot de passe — Leasy Immobilier',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: #063B26; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #CFFF92; margin: 0; font-size: 20px;">Leasy Immobilier</h1>
          </div>
          <div style="border: 1px solid #e0e0e0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #063B26;">Reinitialisation de votre mot de passe</h2>
            <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
            <a href="${resetLink}"
               style="display: inline-block; background-color: #CFFF92; color: #063B26; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
              Reinitialiser mon mot de passe
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 24px;">
              Ce lien est valable 24 heures. Si vous n'avez pas demande cette reinitialisation, ignorez cet email.
            </p>
          </div>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[forgot-password] unexpected:', err)
    return NextResponse.json({ success: true })
  }
}
