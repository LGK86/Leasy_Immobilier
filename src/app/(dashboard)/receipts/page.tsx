import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReceiptList from '@/components/receipts/ReceiptList'

export default async function ReceiptsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: receipts }, { data: properties }, { data: tenants }, { data: payments }] = await Promise.all([
    supabase
      .from('rent_receipts')
      .select('*, property:properties(address, city), tenant:tenants(first_name, last_name, email)')
      .eq('owner_id', user.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false }),
    supabase.from('properties').select('id, address, city').eq('owner_id', user.id),
    supabase.from('tenants').select('id, first_name, last_name, property_id').eq('owner_id', user.id),
    supabase.from('rent_payments').select('id, property_id, tenant_id, period_month, period_year, amount, charges').eq('owner_id', user.id).eq('status', 'paid'),
  ])

  return (
    <ReceiptList
      receipts={receipts ?? []}
      properties={properties ?? []}
      tenants={tenants ?? []}
      payments={payments ?? []}
      userId={user.id}
    />
  )
}
