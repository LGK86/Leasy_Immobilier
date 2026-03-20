import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TenantList from '@/components/tenants/TenantList'

export default async function TenantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tenants }, { data: properties }] = await Promise.all([
    supabase
      .from('tenants')
      .select('*, property:properties(address, city)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('properties').select('id, address, city').eq('owner_id', user.id),
  ])

  return <TenantList tenants={tenants ?? []} properties={properties ?? []} userId={user.id} />
}
