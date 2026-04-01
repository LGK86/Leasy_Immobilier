'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, User, MapPin, Lock } from 'lucide-react'
import type { Profile } from '@/types/database'

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

interface Props {
  profile: Profile | null
  userId: string
}

export default function SettingsForm({ profile, userId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    postal_code: profile?.postal_code ?? '',
  })
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({})
  const strength = pwForm.new ? getPasswordStrength(pwForm.new) : null

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      ...form,
      updated_at: new Date().toISOString(),
    })
    if (error) toast.error('Erreur : ' + error.message)
    else toast.success('Profil mis à jour')
    setLoading(false)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof pwErrors = {}

    if (!pwForm.current) errs.current = 'Champ requis'
    if (pwForm.new.length < 8) errs.new = 'Le mot de passe doit contenir au moins 8 caractères'
    if (pwForm.new !== pwForm.confirm) errs.confirm = 'Les mots de passe ne correspondent pas'

    if (Object.keys(errs).length > 0) { setPwErrors(errs); return }
    setPwErrors({})
    setPwLoading(true)

    // Vérifier le mot de passe actuel
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: pwForm.current,
    })
    if (signInError) {
      setPwErrors({ current: 'Mot de passe actuel incorrect' })
      setPwLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: pwForm.new })
    if (error) {
      toast.error('Erreur : ' + error.message)
    } else {
      toast.success('Mot de passe mis à jour')
      setPwForm({ current: '', new: '', confirm: '' })
    }
    setPwLoading(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Informations personnelles</CardTitle>
          </div>
          <CardDescription>Ces informations apparaîtront sur vos documents et quittances</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input placeholder="Jean" value={form.first_name} onChange={set('first_name')} style={{ textTransform: 'capitalize' }} />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input placeholder="Dupont" value={form.last_name} onChange={set('last_name')} style={{ textTransform: 'capitalize' }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="jean@exemple.com" value={form.email} onChange={set('email')} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input placeholder="06 12 34 56 78" value={form.phone} onChange={set('phone')} />
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <MapPin className="h-4 w-4" /> Adresse
            </div>
            <div className="space-y-2">
              <Label>Rue</Label>
              <Input placeholder="12 rue de la Paix" value={form.address} onChange={set('address')} style={{ textTransform: 'capitalize' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input placeholder="75001" value={form.postal_code} onChange={set('postal_code')} />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input placeholder="Paris" value={form.city} onChange={set('city')} style={{ textTransform: 'capitalize' }} />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer les modifications
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Modifier le mot de passe</CardTitle>
          </div>
          <CardDescription>
            Choisissez un mot de passe sécurisé d&apos;au moins 8 caractères.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Mot de passe actuel</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
              />
              {pwErrors.current && <p className="text-xs text-red-600">{pwErrors.current}</p>}
            </div>

            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={pwForm.new}
                onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))}
              />
              {pwForm.new && strength && (
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
              {pwErrors.new && <p className="text-xs text-red-600">{pwErrors.new}</p>}
            </div>

            <div className="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              />
              {pwErrors.confirm && <p className="text-xs text-red-600">{pwErrors.confirm}</p>}
            </div>

            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Mettre à jour le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
