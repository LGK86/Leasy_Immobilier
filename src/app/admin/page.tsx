export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Home, UserCheck, CreditCard, TrendingUp, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export default async function AdminDashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const [
    { data: profiles },
    { data: properties },
    { data: tenants },
    { data: monthPayments },
  ] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, email, created_at').order('created_at', { ascending: false }),
    supabase.from('properties').select('id, owner_id'),
    supabase.from('tenants').select('id'),
    supabase.from('rent_payments').select('id, amount, charges').eq('period_month', month).eq('period_year', year).eq('status', 'received'),
  ])

  const ownerIdSet: Record<string, true> = {}
  for (const p of properties ?? []) ownerIdSet[p.owner_id] = true
  const totalUsers    = (profiles ?? []).length
  const activeUsers   = Object.keys(ownerIdSet).length
  const totalProps    = (properties ?? []).length
  const totalTenants  = (tenants ?? []).length
  const paymentsCount = (monthPayments ?? []).length
  const totalRevenue  = (monthPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount) + Number(p.charges), 0)

  const recentUsers = (profiles ?? []).slice(0, 5)

  const stats = [
    { label: 'Utilisateurs inscrits',    value: totalUsers,   icon: Users,     color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Utilisateurs actifs',      value: activeUsers,  icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Biens immobiliers',        value: totalProps,   icon: Home,      color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'Locataires',               value: totalTenants, icon: Users,     color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Paiements reçus ce mois',  value: paymentsCount, icon: CreditCard, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Revenus ce mois (€)',      value: fmt(totalRevenue), icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Vue d&apos;ensemble</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent users */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-700 text-sm">5 derniers inscrits</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <p className="text-xs text-slate-400">
                  {format(new Date(u.created_at), 'dd MMM yyyy', { locale: fr })}
                </p>
              </div>
            ))}
            {recentUsers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Aucun utilisateur</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
