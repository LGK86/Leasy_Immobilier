import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PaymentList from '@/components/payments/PaymentList'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: payments }, { data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('*, property:properties(address, city), tenant:tenants(first_name, last_name)')
      .eq('owner_id', user.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false }),
    supabase.from('properties').select('id, address, city').eq('owner_id', user.id),
    supabase.from('tenants').select('id, first_name, last_name, property_id').eq('owner_id', user.id),
  ])

  return (
    <PaymentList
      payments={payments ?? []}
      properties={properties ?? []}
      tenants={tenants ?? []}
      userId={user.id}
    />
  )
}
