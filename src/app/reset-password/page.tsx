'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function getPasswordStrength(password: string) {
  if (password.length < 8) return { label: 'Faible', color: 'red' as const }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Moyen', color: 'orange' as const }
  return { label: 'Fort', color: 'green' as const }
}

const strengthStyles = {
  red: { bar: 'bg-red-500', text: 'text-red-600', width: 'w-1/3' },
  orange: { bar: 'bg-orange-500', text: 'text-orange-600', width: 'w-2/3' },
  green: { bar: 'bg-emerald-500', text: 'text-emerald-600', width: 'w-full' },
}

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [errors, setErrors] = useState<{ new?: string; confirm?: string }>({})
  const router = useRouter()
  const supabase = createClient()

  const strength = newPassword ? getPasswordStrength(newPassword) : null

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true)
      }
    })
    return () => { authListener.subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}

    if (newPassword.length < 8) errs.new = 'Le mot de passe doit contenir au moins 8 caractères'
    if (newPassword !== confirmPassword) errs.confirm = 'Les mots de passe ne correspondent pas'

    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      toast.error('Erreur : ' + error.message)
      setLoading(false)
      return
    }

    toast.success('Mot de passe mis à jour avec succès')
    router.push('/login')
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-800">Leasy Immobilier</span>
            </div>
          </div>
          <Card>
            <CardContent className="py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-slate-400" />
              <p className="text-sm text-slate-500">Vérification du lien en cours...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-800">Leasy Immobilier</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Réinitialiser le mot de passe</CardTitle>
            <CardDescription>Choisissez un nouveau mot de passe sécurisé</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                {newPassword && strength && (
                  <div className="space-y-1 pt-1">
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${strengthStyles[strength.color].bar} ${strengthStyles[strength.color].width}`}
                      />
                    </div>
                    <p className={`text-xs font-medium ${strengthStyles[strength.color].text}`}>
                      Force : {strength.label}
                    </p>
                  </div>
                )}
                {errors.new && <p className="text-xs text-red-600">{errors.new}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {errors.confirm && <p className="text-xs text-red-600">{errors.confirm}</p>}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 mt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Réinitialiser le mot de passe
              </Button>
              <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 text-center">
                ← Retour à la connexion
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
