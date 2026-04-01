'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, 'Session:', !!session)
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
        setChecking(false)
      } else if (event === 'SIGNED_IN' && session) {
        setSessionReady(true)
        setChecking(false)
      }
    })

    const timeout = setTimeout(() => {
      setChecking(false)
      if (!sessionReady) {
        setError('Lien invalide ou expiré. Veuillez faire une nouvelle demande.')
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Erreur : ' + error.message)
      setLoading(false)
      return
    }

    router.push('/login?message=password_updated')
  }

  const getStrength = (pwd: string) => {
    if (pwd.length < 8) return { label: 'Faible', color: '#ef4444', width: '33%' }
    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return { label: 'Moyen', color: '#f97316', width: '66%' }
    return { label: 'Fort', color: '#22c55e', width: '100%' }
  }

  const strength = getStrength(password)

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Arial' }}>
        <p>Vérification du lien en cours...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'Arial' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#063B26' }}>Leasy Immobilier</h1>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Réinitialiser le mot de passe</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Choisissez un nouveau mot de passe sécurisé</p>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: '#dc2626', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {sessionReady ? (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
                {password && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: strength.width, backgroundColor: strength.color, transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ fontSize: '12px', color: strength.color, marginTop: '4px' }}>Force : {strength.label}</p>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '12px', backgroundColor: '#CFFF92', color: '#063B26', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}
              </button>
            </form>
          ) : (
            <p style={{ color: '#dc2626' }}>{error}</p>
          )}

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <a href="/login" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>← Retour à la connexion</a>
          </div>
        </div>
      </div>
    </div>
  )
}
