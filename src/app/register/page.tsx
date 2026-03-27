'use client'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Building2, Loader2, Mail } from 'lucide-react'

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (!/[A-Z]/.test(pw)) return 'Le mot de passe doit contenir au moins une majuscule.'
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Le mot de passe doit contenir au moins un chiffre ou caractère spécial.'
  return null
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const pwError = validatePassword(password)
    if (pwError) { toast.error(pwError); return }
    if (password !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          email,
          updated_at: new Date().toISOString(),
        })
      }
      setEmailSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-leasy-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-leasy-accent p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-leasy-dark" />
            </div>
            <span className="text-2xl font-bold text-leasy-dark">Leasy Immobilier</span>
          </div>
        </div>

        {emailSent ? (
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-[#CFFF92] rounded-full flex items-center justify-center mx-auto">
                  <Mail className="h-8 w-8 text-[#063B26]" />
                </div>
                <h2 className="text-xl font-bold text-[#063B26]">Vérifiez votre email</h2>
                <p className="text-slate-500">
                  Un email de confirmation a été envoyé à <span className="font-medium">{email}</span>.
                  Cliquez sur le lien dans l&apos;email pour activer votre compte.
                </p>
                <p className="text-sm text-slate-400">
                  Vous ne trouvez pas l&apos;email ? Vérifiez vos spams.
                </p>
                <a href="/login" className="text-[#063B26] font-medium hover:underline block">
                  Retour à la connexion
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Créer un compte</CardTitle>
              <CardDescription>Gérez vos biens locatifs en toute simplicité</CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4 pb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      placeholder="Jean"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{ textTransform: 'capitalize' }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      placeholder="Dupont"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      style={{ textTransform: 'capitalize' }}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-leasy-muted">8 caractères min., 1 majuscule, 1 chiffre ou caractère spécial</p>
                </div>
                <div className="space-y-2 pb-1">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 mt-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Créer mon compte
                </Button>
                <p className="text-sm text-leasy-muted text-center">
                  Déjà un compte ?{' '}
                  <Link href="/login" className="text-leasy-dark hover:underline font-medium">
                    Se connecter
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
