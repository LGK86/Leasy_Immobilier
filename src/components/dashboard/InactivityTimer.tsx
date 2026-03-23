'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000  // 15 min
const WARNING_BEFORE_MS = 60 * 1000          // 1 min avant
const WARNING_AT_MS = INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS

export default function InactivityTimer() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownValueRef = useRef(60)

  const clearAllTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const handleLogout = useCallback(async () => {
    clearAllTimers()
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.removeItem('leasy_remember_me')
    router.push('/login')
  }, [router])

  const startCountdown = useCallback(() => {
    setShowWarning(true)
    countdownValueRef.current = 60
    setCountdown(60)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      countdownValueRef.current -= 1
      setCountdown(countdownValueRef.current)
      if (countdownValueRef.current <= 0) {
        clearInterval(countdownRef.current!)
        handleLogout()
      }
    }, 1000)
  }, [handleLogout])

  const resetTimer = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)
    setCountdown(60)
    timerRef.current = setTimeout(startCountdown, WARNING_AT_MS)
  }, [startCountdown])

  const handleStayConnected = () => {
    resetTimer()
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('leasy_remember_me') === 'true') return

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart']
    const onActivity = () => {
      if (!showWarning) resetTimer()
    }

    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    resetTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!showWarning) return null

  const progress = (countdown / 60) * 100

  return (
    <div className="fixed top-4 right-4 z-50 w-80 rounded-xl shadow-lg border border-slate-200 bg-white overflow-hidden">
      {/* Barre de progression */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-[#063B26] transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        <p className="text-[#063B26] font-semibold text-sm mb-1">
          Session sur le point d&apos;expirer
        </p>
        <p className="text-slate-500 text-xs mb-4">
          Vous serez déconnecté dans{' '}
          <span className="font-bold text-[#063B26]">{countdown}</span> seconde{countdown > 1 ? 's' : ''}
          {' '}en raison d&apos;inactivité.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleStayConnected}
            className="flex-1 bg-[#CFFF92] text-[#063B26] text-xs font-semibold py-2 px-3 rounded-lg hover:bg-[#b8f070] transition-colors"
          >
            Rester connecté
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 bg-slate-100 text-slate-600 text-xs font-semibold py-2 px-3 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
