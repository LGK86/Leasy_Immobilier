'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Tenant } from '@/types/database'

interface Props {
  tenant: Tenant | null
  properties: { id: string; address: string; city: string }[]
  userId: string
  onSuccess: () => void
}

export default function TenantForm({ tenant, properties, userId, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: tenant?.first_name ?? '',
    last_name: tenant?.last_name ?? '',
    email: tenant?.email ?? '',
    phone: tenant?.phone ?? '',
    property_id: tenant?.property_id ?? '',
    entry_date: tenant?.entry_date ?? '',
    lease_end_date: tenant?.lease_end_date ?? '',
    tacite_reconduction: tenant?.tacite_reconduction ?? false,
  })

  const handleEntryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const entry = e.target.value
    let leaseEnd = form.lease_end_date
    if (entry && !form.lease_end_date) {
      const d = new Date(entry)
      d.setFullYear(d.getFullYear() + 1)
      leaseEnd = d.toISOString().split('T')[0]
    }
    setForm(f => ({ ...f, entry_date: entry, lease_end_date: leaseEnd }))
  }

  const save = async (status: 'draft' | 'active') => {
    setLoading(true)

    const data = {
      owner_id: userId,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone || null,
      property_id: form.property_id || null,
      entry_date: form.entry_date || null,
      lease_end_date: form.lease_end_date || null,
      tacite_reconduction: form.tacite_reconduction,
      status,
      updated_at: new Date().toISOString(),
    }

    let error
    if (tenant) {
      const res = await supabase.from('tenants').update(data).eq('id', tenant.id)
      error = res.error
    } else {
      const res = await supabase.from('tenants').insert(data)
      error = res.error
    }

    if (error) toast.error('Erreur : ' + error.message)
    else {
      toast.success(status === 'draft' ? 'Brouillon sauvegardé' : 'Locataire validé')
      onSuccess()
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await save('active')
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Prénom</Label>
          <Input placeholder="Jean" value={form.first_name} onChange={set('first_name')} required />
        </div>
        <div className="space-y-2">
          <Label>Nom</Label>
          <Input placeholder="Dupont" value={form.last_name} onChange={set('last_name')} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" placeholder="jean@exemple.com" value={form.email} onChange={set('email')} required />
      </div>
      <div className="space-y-2">
        <Label>Téléphone</Label>
        <Input placeholder="06 12 34 56 78" value={form.phone} onChange={set('phone')} />
      </div>
      <div className="space-y-2">
        <Label>Bien associé</Label>
        <Select value={form.property_id || undefined} onValueChange={(v) => setForm(f => ({ ...f, property_id: v ?? '' }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sélectionner un bien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Aucun</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}, {p.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date d&apos;entrée</Label>
          <Input type="date" value={form.entry_date} onChange={handleEntryDateChange} />
        </div>
        <div className="space-y-2">
          <Label>Fin de bail</Label>
          <Input type="date" value={form.lease_end_date} onChange={set('lease_end_date')} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="tacite"
          type="checkbox"
          checked={form.tacite_reconduction}
          onChange={e => setForm(f => ({ ...f, tacite_reconduction: e.target.checked }))}
          className="h-4 w-4 rounded border-leasy-border accent-leasy-dark"
        />
        <Label htmlFor="tacite" className="cursor-pointer font-normal">Tacite reconduction</Label>
      </div>
      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={loading}
          onClick={() => save('draft')}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Sauvegarder
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Valider
        </Button>
      </div>
    </form>
  )
}
