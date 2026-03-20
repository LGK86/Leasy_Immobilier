'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, User, MapPin, Phone, Lock } from 'lucide-react'
import type { Profile } from '@/types/database'

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
  const [newPassword, setNewPassword] = useState('')

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
    if (newPassword.length < 6) { toast.error('Le mot de passe doit contenir au moins 6 caractères'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error('Erreur : ' + error.message)
    else { toast.success('Mot de passe mis à jour'); setNewPassword('') }
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
                <Input placeholder="Jean" value={form.first_name} onChange={set('first_name')} />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input placeholder="Dupont" value={form.last_name} onChange={set('last_name')} />
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
              <Input placeholder="12 rue de la Paix" value={form.address} onChange={set('address')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input placeholder="75001" value={form.postal_code} onChange={set('postal_code')} />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input placeholder="Paris" value={form.city} onChange={set('city')} />
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
            <CardTitle className="text-base">Sécurité</CardTitle>
          </div>
          <CardDescription>Modifiez votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" disabled={pwLoading} variant="outline">
              {pwLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Changer le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
