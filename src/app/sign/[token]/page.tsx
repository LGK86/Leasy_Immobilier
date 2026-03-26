import { createClient } from '@supabase/supabase-js'
import SignPage from './SignPage'

export const dynamic = 'force-dynamic'

export default async function SignTokenPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { tid?: string }
}) {
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

  // Determine signing tenant ID
  const tenantId = searchParams.tid ?? doc.tenant_id ?? null

  // Resolve all tenant IDs (supports both array and legacy comma-string formats)
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

  // Check if this specific tenant has already signed
  const tenantSignatures: Record<string, string> = doc.content?.tenant_signatures ?? {}
  if (tenantId && tenantSignatures[tenantId]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F4]">
        <div className="text-center max-w-md p-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Signature enregistrée</h1>
          <p className="text-slate-500">Vous avez déjà signé ce document. En attente de la signature des autres parties.</p>
        </div>
      </div>
    )
  }

  // Fetch the specific signing tenant if different from the primary tenant
  let signingTenant = doc.tenant
  if (tenantId && tenantId !== doc.tenant_id) {
    const { data: fetchedTenant } = await serviceClient
      .from('tenants')
      .select('id, first_name, last_name, email')
      .eq('id', tenantId)
      .single()
    if (fetchedTenant) signingTenant = fetchedTenant
  }

  return <SignPage doc={doc} token={params.token} tenantId={tenantId} signingTenant={signingTenant} />
}
