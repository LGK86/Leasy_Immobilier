'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import AddressAutocomplete from '@/components/ui/address-autocomplete'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Property } from '@/types/database'

interface PropertyFormProps {
  property: Property | null
  userId: string
  onSuccess: () => void
}

export default function PropertyForm({ property, userId, onSuccess }: PropertyFormProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    address: property?.address ?? '',
    city: property?.city ?? '',
    postal_code: property?.postal_code ?? '',
    type: property?.type ?? 'apartment',
    monthly_rent: property?.monthly_rent?.toString() ?? '',
    charges: property?.charges?.toString() ?? '0',
    deposit: property?.deposit?.toString() ?? '',
    status: property?.status ?? 'vacant',
    description: property?.description ?? '',
    surface: property?.surface?.toString() ?? '',
    rooms_count: property?.rooms_count?.toString() ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const data = {
      owner_id: userId,
      address: form.address,
      city: form.city,
      postal_code: form.postal_code,
      type: form.type,
      monthly_rent: parseFloat(form.monthly_rent) || 0,
      charges: parseFloat(form.charges) || 0,
      deposit: parseFloat(form.deposit) || 0,
      status: form.status,
      description: form.description || null,
      surface: parseFloat(form.surface) || null,
      rooms_count: parseInt(form.rooms_count) || null,
      updated_at: new Date().toISOString(),
    }

    let error
    if (property) {
      const res = await supabase.from('properties').update(data).eq('id', property.id)
      error = res.error
    } else {
      const res = await supabase.from('properties').insert(data)
      error = res.error
    }

    if (error) {
      toast.error('Erreur : ' + error.message)
    } else {
      toast.success(property ? 'Bien modifié' : 'Bien ajouté')
      onSuccess()
    }
    setLoading(false)
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const setSelect = (key: string) => (value: string | null) =>
    setForm(f => ({ ...f, [key]: value ?? '' }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Adresse</Label>
        <AddressAutocomplete
          value={form.address}
          onChange={(address, city, postalCode) =>
            setForm(f => ({
              ...f,
              address,
              ...(city ? { city } : {}),
              ...(postalCode ? { postal_code: postalCode } : {}),
            }))
          }
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Code postal</Label>
          <Input placeholder="75001" value={form.postal_code} onChange={set('postal_code')} required />
        </div>
        <div className="space-y-2">
          <Label>Ville</Label>
          <Input placeholder="Paris" value={form.city} onChange={set('city')} style={{ textTransform: 'capitalize' }} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type de bien</Label>
          <Select value={form.type} onValueChange={setSelect('type')}>
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left truncate text-sm">
                {({'apartment':'Appartement','house':'Maison','studio':'Studio','room':'Chambre','other':'Autre'} as Record<string,string>)[form.type]}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">Appartement</SelectItem>
              <SelectItem value="house">Maison</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
              <SelectItem value="room">Chambre</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={setSelect('status')}>
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left truncate text-sm">
                {({'rented':'Loué','vacant':'Vacant'} as Record<string,string>)[form.status]}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rented">Loué</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Surface (m²)</Label>
          <Input type="number" inputMode="decimal" placeholder="45" value={form.surface} onChange={set('surface')} />
        </div>
        <div className="space-y-2">
          <Label>Nombre de pièces</Label>
          <Input type="number" inputMode="numeric" placeholder="3" value={form.rooms_count} onChange={set('rooms_count')} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Loyer (€)</Label>
          <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="800" value={form.monthly_rent} onChange={set('monthly_rent')} required step="10" />
        </div>
        <div className="space-y-2">
          <Label>Charges (€)</Label>
          <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="50" value={form.charges} onChange={set('charges')} step="10" />
        </div>
        <div className="space-y-2">
          <Label>Dépôt (€)</Label>
          <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="1600" value={form.deposit} onChange={set('deposit')} step="10" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description (optionnel)</Label>
        <Textarea placeholder="Notes sur le bien..." value={form.description} onChange={set('description')} rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {property ? 'Enregistrer les modifications' : 'Ajouter le bien'}
      </Button>
    </form>
  )
}
