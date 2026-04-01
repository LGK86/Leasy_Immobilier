import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, CreditCard, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'
import OnboardingContainer from '@/components/dashboard/OnboardingContainer'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const [
    { data: profile },
    { data: properties },
    { data: onboardingProperties },
    { data: tenants },
    { data: payments },
    { data: currentMonthPayments },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('properties').select('*').eq('owner_id', user.id),
    supabase.from('properties').select('id, address, city').eq('owner_id', user.id),
    supabase.from('tenants').select('*').eq('owner_id', user.id),
    supabase.from('rent_payments').select('*, tenant:tenants(first_name, last_name), property:properties(address)').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('rent_payments').select('*').eq('owner_id', user.id).eq('period_month', currentMonth).eq('period_year', currentYear),
  ])

  const totalRent = (properties ?? []).reduce((sum, p) => sum + Number(p.monthly_rent), 0)
  const rentedCount = (properties ?? []).filter(p => p.status === 'rented').length
  const vacantCount = (properties ?? []).filter(p => p.status === 'vacant').length
  const paidCount = (currentMonthPayments ?? []).filter(p => p.status === 'paid').length
  const pendingCount = (currentMonthPayments ?? []).filter(p => p.status === 'pending').length
  const lateCount = (currentMonthPayments ?? []).filter(p => p.status === 'late').length

  const stats = [
    {
      title: 'Biens immobiliers',
      value: properties?.length ?? 0,
      sub: `${rentedCount} loué(s) · ${vacantCount} vacant(s)`,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/properties',
    },
    {
      title: 'Locataires',
      value: tenants?.length ?? 0,
      sub: 'locataires actifs',
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      href: '/tenants',
    },
    {
      title: 'Loyers du mois',
      value: `${totalRent.toLocaleString('fr-FR')} €`,
      sub: `${paidCount} payé(s) · ${pendingCount} en attente · ${lateCount} en retard`,
      icon: CreditCard,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/payments',
    },
    {
      title: 'Revenus mensuels',
      value: `${totalRent.toLocaleString('fr-FR')} €`,
      sub: 'loyers + charges',
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/payments',
    },
  ]

  const monthName = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">
          <OnboardingContainer
            initialStep={profile?.onboarding_step ?? 0}
            userId={user.id}
            initialProperties={onboardingProperties ?? []}
          />
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">
              Bonjour {profile?.first_name ?? ''} 👋
            </h1>
            <p className="text-slate-500 mt-1">Voici votre tableau de bord pour {monthName}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 rounded-lg ${stat.bg}`}>
                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                    <div className="text-sm font-medium text-slate-600 mt-1">{stat.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{stat.sub}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Derniers paiements</CardTitle>
              </CardHeader>
              <CardContent>
                {payments && payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {p.tenant?.first_name} {p.tenant?.last_name}
                          </p>
                          <p className="text-xs text-slate-400">{p.property?.address}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">{Number(p.amount).toLocaleString('fr-FR')} €</span>
                          <Badge
                            variant={p.status === 'paid' ? 'default' : p.status === 'late' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {p.status === 'paid' ? 'Payé' : p.status === 'late' ? 'Retard' : 'En attente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">Aucun paiement enregistré</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statut des biens</CardTitle>
              </CardHeader>
              <CardContent>
                {properties && properties.length > 0 ? (
                  <div className="space-y-3">
                    {properties.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-2">
                          {p.status === 'rented'
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : <AlertCircle className="h-4 w-4 text-amber-500" />
                          }
                          <div>
                            <p className="text-sm font-medium text-slate-700">{p.address}</p>
                            <p className="text-xs text-slate-400">{p.city}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={p.status === 'rented' ? 'default' : 'secondary'}>
                            {p.status === 'rented' ? 'Loué' : 'Vacant'}
                          </Badge>
                          <p className="text-xs text-slate-500 mt-1">{Number(p.monthly_rent).toLocaleString('fr-FR')} €/mois</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-400 mb-3">Aucun bien enregistré</p>
                    <Link href="/properties" className="text-sm text-blue-600 hover:underline">
                      Ajouter votre premier bien →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
