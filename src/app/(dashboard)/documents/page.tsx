import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocumentList from '@/components/documents/DocumentList'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: documents }, { data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from('documents')
      .select('*, property:properties(address, city), tenant:tenants(first_name, last_name)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('properties').select('id, address, city, surface, rooms_count').eq('owner_id', user.id),
    supabase.from('tenants').select('id, first_name, last_name, property_id, email, phone, entry_date').eq('owner_id', user.id),
  ])

  return (
    <DocumentList
      documents={documents ?? []}
      properties={properties ?? []}
      tenants={tenants ?? []}
      userId={user.id}
    />
  )
}
