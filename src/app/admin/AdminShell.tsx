'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users } from 'lucide-react'

const navItems = [
  { href: '/admin',       label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
]

export default function AdminShell({
  children,
  userEmail,
}: {
  children: React.ReactNode
  userEmail: string
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-[#F5F6F4]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#063B26' }}>
        <div className="px-4 py-5 border-b border-white/10">
          <span className="text-white font-bold text-lg">Leasy Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={active
                  ? { backgroundColor: '#CFFF92', color: '#063B26' }
                  : { color: 'rgba(255,255,255,0.75)' }
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-white/50 text-xs truncate">{userEmail}</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center px-6 bg-white border-b border-slate-200">
          <span className="font-semibold text-slate-700">Leasy Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
