export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient as createCookieClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import AdminShell from './AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Get current user via cookie session
  const cookieClient = await createCookieClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) redirect('/login')

  // Check admin whitelist via service role (bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('email', user.email!)
    .maybeSingle()

  if (!adminRow) redirect('/dashboard')

  return <AdminShell userEmail={user.email!}>{children}</AdminShell>
}
