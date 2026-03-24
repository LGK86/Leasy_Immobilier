import { createClient } from '@supabase/supabase-js'
import SignPage from './SignPage'

export const dynamic = 'force-dynamic'

export default async function SignTokenPage({ params }: { params: { token: string } }) {
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: doc } = await serviceClient
    .from('documents')
    .select('*, tenant:tenants(*), property:properties(*), owner:profiles!owner_id(*)')
    .eq('signing_token', params.token)
    .single()

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F4]">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Lien invalide</h1>
          <p className="text-slate-500">Ce lien de signature est invalide ou n&apos;existe pas.</p>
        </div>
      </div>
    )
  }

  if (doc.signing_token_expires_at && new Date(doc.signing_token_expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F4]">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Lien expiré</h1>
          <p className="text-slate-500">Ce lien de signature a expiré. Veuillez contacter votre bailleur.</p>
        </div>
      </div>
    )
  }

  if (doc.status === 'finalized') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F4]">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Document déjà signé</h1>
          <p className="text-slate-500">Ce document a déjà été signé par toutes les parties.</p>
        </div>
      </div>
    )
  }

  return <SignPage doc={doc} token={params.token} />
}
