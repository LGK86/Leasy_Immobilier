'use client'

import { useState } from 'react'
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
  ChevronLeft,
  ChevronRight,
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <div
      className={`flex flex-col transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{ backgroundColor: '#063B26' }}
    >
      <div className={cn('border-b border-white/10', collapsed ? 'p-4 flex justify-center' : 'p-6')}>
        {!collapsed && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-leasy-accent p-2 rounded-lg">
                <Building2 className="h-5 w-5 text-leasy-dark" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Leasy</p>
                <p className="text-xs text-white/50">Immobilier</p>
              </div>
            </div>
            <button onClick={toggle} className="text-white/50 hover:text-white transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-2">
            <div className="bg-leasy-accent p-2 rounded-lg">
              <Building2 className="h-5 w-5 text-leasy-dark" />
            </div>
            <button
              onClick={toggle}
              className="text-white/50 hover:text-white transition-colors"
              title="Agrandir le menu"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
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
              prefetch={true}
              title={collapsed ? item.name : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0 py-3',
                isActive
                  ? 'bg-leasy-accent text-leasy-dark'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className={cn(
                isActive ? 'text-leasy-dark' : 'text-white/50',
                collapsed ? 'h-6 w-6' : 'h-5 w-5'
              )} />
              {!collapsed && item.name}
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
