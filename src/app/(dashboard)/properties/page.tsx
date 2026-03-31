import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PropertyList from '@/components/properties/PropertyList'

export default async function PropertiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: properties } = await supabase
    .from('properties')
    .select('*, documents(id, type, status, content)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return <PropertyList properties={properties ?? []} userId={user.id} />
}
