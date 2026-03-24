export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import AdminUsersClient from './AdminUsersClient'

export default async function AdminUsersPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: profiles }, { data: properties }, { data: tenants }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('properties').select('id, owner_id'),
    supabase.from('tenants').select('id, owner_id, first_name, last_name, email'),
  ])

  // Count per owner
  const propCount: Record<string, number>   = {}
  const tenantCount: Record<string, number> = {}
  const tenantsByOwner: Record<string, any[]> = {}
  const propsByOwner: Record<string, any[]>   = {}

  for (const p of properties ?? []) {
    propCount[p.owner_id] = (propCount[p.owner_id] ?? 0) + 1
    propsByOwner[p.owner_id] = [...(propsByOwner[p.owner_id] ?? []), p]
  }
  for (const t of tenants ?? []) {
    tenantCount[t.owner_id] = (tenantCount[t.owner_id] ?? 0) + 1
    tenantsByOwner[t.owner_id] = [...(tenantsByOwner[t.owner_id] ?? []), t]
  }

  const users = (profiles ?? []).map((p: any) => ({
    ...p,
    propertyCount: propCount[p.id] ?? 0,
    tenantCount:   tenantCount[p.id] ?? 0,
    properties:    propsByOwner[p.id] ?? [],
    tenants:       tenantsByOwner[p.id] ?? [],
  }))

  return <AdminUsersClient users={users} />
}
