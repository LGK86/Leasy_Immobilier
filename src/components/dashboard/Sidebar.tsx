'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  FileText,
  FolderOpen,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mes biens', href: '/properties', icon: Building2 },
  { name: 'Mes locataires', href: '/tenants', icon: Users },
  { name: 'Paiements', href: '/payments', icon: CreditCard },
  { name: 'Quittances', href: '/receipts', icon: FileText },
  { name: 'Documents', href: '/documents', icon: FolderOpen },
  { name: 'Paramètres', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 flex flex-col" style={{ backgroundColor: '#063B26' }}>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="bg-leasy-accent p-2 rounded-lg">
            <Building2 className="h-5 w-5 text-leasy-dark" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Leasy</p>
            <p className="text-xs text-white/50">Immobilier</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-leasy-accent text-leasy-dark'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-leasy-dark' : 'text-white/50')} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-white/30 text-center">v1.0.0</p>
      </div>
    </div>
  )
}
