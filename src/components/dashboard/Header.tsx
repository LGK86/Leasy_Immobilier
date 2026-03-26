'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import type { Profile } from '@/types/database'
import NotificationBell from '@/components/dashboard/NotificationBell'

export default function Header({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  const displayName = profile
    ? `${profile.first_name ?? ''} ${(profile.last_name ?? '').toUpperCase()}`.trim() || profile.email
    : 'Utilisateur'

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-2">
        {profile?.id && <NotificationBell userId={profile.id} />}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-[#063B26] flex items-center justify-center text-[#CFFF92] text-sm font-semibold">
              {initials}
            </div>
            <span className="text-sm font-medium text-slate-700">{displayName}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-3 py-2 text-xs text-slate-400 font-medium">Mon compte</div>
              <hr className="border-slate-100 my-1" />
              <button
                onClick={() => { setOpen(false); router.push('/settings') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Paramètres
              </button>
              <hr className="border-slate-100 my-1" />
              <button
                onClick={() => { setOpen(false); handleSignOut() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
