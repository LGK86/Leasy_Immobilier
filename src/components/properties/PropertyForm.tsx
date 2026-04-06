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
    construction_period: property?.construction_year
      ? (property.construction_year < 1946 ? 'avant_1946'
        : property.construction_year <= 1970 ? '1946_1970'
        : property.construction_year <= 1990 ? '1971_1990'
        : 'apres_1990')
      : '',
    rental_type: property?.rental_type ?? 'unfurnished',
  })

  const [rentControlResult, setRentControlResult] = useState<{
    status: 'compliant' | 'non_compliant' | 'not_applicable' | null
    ref_price?: number
    max_price?: number
    min_price?: number
    zone_name?: string
  } | null>(property?.rent_control_status ? {
    status: property.rent_control_status as 'compliant' | 'non_compliant' | 'not_applicable',
    ref_price: property.rent_control_reference ?? undefined,
    max_price: property.rent_control_max ?? undefined,
    min_price: property.rent_control_min ?? undefined,
  } : null)
  const [checkingRentControl, setCheckingRentControl] = useState(false)

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
      construction_year: ({'avant_1946':1945,'1946_1970':1960,'1971_1990':1980,'apres_1990':2000} as Record<string,number>)[form.construction_period] || null,
      rental_type: form.rental_type || null,
      rent_control_status: rentControlResult?.status ?? property?.rent_control_status ?? null,
      rent_control_reference: rentControlResult?.ref_price ?? property?.rent_control_reference ?? null,
      rent_control_max: rentControlResult?.max_price ?? property?.rent_control_max ?? null,
      rent_control_min: rentControlResult?.min_price ?? property?.rent_control_min ?? null,
      rent_control_checked_at: rentControlResult ? new Date().toISOString() : (property?.rent_control_checked_at ?? null),
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

  const checkRentControl = async () => {
    const construction_period = form.construction_period
    if (!form.city || !form.rooms_count || !form.surface || !construction_period || !form.rental_type) {
      toast.error('Veuillez renseigner la ville, le nombre de pièces, la surface, la période de construction et le type de location.')
      return
    }

    setCheckingRentControl(true)

    try {
      const rooms = Math.min(parseInt(form.rooms_count), 5)

      const cityNormalized = form.city.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim()

      // Récupérer le millésime le plus récent disponible
      const { data: latestYear } = await supabase
        .from('rent_control_zones')
        .select('year')
        .ilike('city', `%${cityNormalized}%`)
        .order('year', { ascending: false })
        .limit(1)

      const year = latestYear?.[0]?.year

      if (!year) {
        setRentControlResult({ status: 'not_applicable' })
        return
      }

      const { data: zones } = await supabase
        .from('rent_control_zones')
        .select('*')
        .ilike('city', `%${cityNormalized}%`)
        .eq('rooms_count', rooms)
        .eq('construction_period', construction_period)
        .eq('rental_type', form.rental_type)
        .eq('year', year)
        .limit(1)

      if (!zones || zones.length === 0) {
        const result = { status: 'not_applicable' as const }
        setRentControlResult(result)

        if (property) {
          await supabase.from('properties').update({
            rent_control_status: 'not_applicable',
            rent_control_checked_at: new Date().toISOString(),
          }).eq('id', property.id)
        }
        return
      }

      const zone = zones[0]
      const loyer_au_m2 = parseFloat(form.monthly_rent) / parseFloat(form.surface)
      const isCompliant = loyer_au_m2 <= zone.max_price

      const result = {
        status: isCompliant ? 'compliant' as const : 'non_compliant' as const,
        ref_price: zone.ref_price,
        max_price: zone.max_price,
        min_price: zone.min_price,
        zone_name: zone.zone_name,
      }
      setRentControlResult(result)

      if (property) {
        await supabase.from('properties').update({
          rent_control_status: result.status,
          rent_control_reference: zone.ref_price,
          rent_control_max: zone.max_price,
          rent_control_min: zone.min_price,
          rent_control_checked_at: new Date().toISOString(),
        }).eq('id', property.id)
      }

    } catch (err) {
      toast.error('Erreur lors de la vérification')
      console.error(err)
    } finally {
      setCheckingRentControl(false)
    }
  }

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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Période de construction</Label>
          <Select value={form.construction_period} onValueChange={setSelect('construction_period')}>
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left truncate text-sm">
                {({'avant_1946':'Avant 1946','1946_1970':'1946 - 1970','1971_1990':'1971 - 1990','apres_1990':'Après 1990'} as Record<string,string>)[form.construction_period] ?? 'Sélectionner'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avant_1946">Avant 1946</SelectItem>
              <SelectItem value="1946_1970">1946 - 1970</SelectItem>
              <SelectItem value="1971_1990">1971 - 1990</SelectItem>
              <SelectItem value="apres_1990">Après 1990</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type de location</Label>
          <Select value={form.rental_type} onValueChange={setSelect('rental_type')}>
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left truncate text-sm">
                {form.rental_type === 'furnished' ? 'Meublé' : 'Non meublé'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unfurnished">Non meublé</SelectItem>
              <SelectItem value="furnished">Meublé</SelectItem>
            </SelectContent>
          </Select>
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

      {/* Encadrement des loyers */}
      <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Encadrement des loyers</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={checkRentControl}
            disabled={checkingRentControl}
          >
            {checkingRentControl ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-2" />Vérification...</>
            ) : (
              'Vérifier'
            )}
          </Button>
        </div>

        {rentControlResult && (
          <div className={`text-sm rounded-lg p-3 ${
            rentControlResult.status === 'compliant'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : rentControlResult.status === 'non_compliant'
              ? 'bg-orange-50 border border-orange-200 text-orange-800'
              : 'bg-slate-100 border border-slate-200 text-slate-600'
          }`}>
            {rentControlResult.status === 'compliant' && (
              <p>✅ Loyer conforme à l&apos;encadrement des loyers.</p>
            )}
            {rentControlResult.status === 'non_compliant' && (
              <>
                <p className="font-medium">⚠️ Loyer au-dessus du plafond légal.</p>
                <p className="mt-1">Loyer de référence majoré : <strong>{rentControlResult.max_price} €/m²</strong> (soit {Math.round((rentControlResult.max_price ?? 0) * parseFloat(form.surface || '0'))} €/mois pour {form.surface} m²)</p>
                <p className="mt-1 text-xs">Un dépassement est possible uniquement via un complément de loyer justifié par des caractéristiques exceptionnelles du logement (vue, terrasse, prestations haut de gamme).</p>
              </>
            )}
            {rentControlResult.status === 'not_applicable' && (
              <p>ℹ️ Ce bien n&apos;est pas situé dans une zone soumise à l&apos;encadrement des loyers.</p>
            )}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {property ? 'Enregistrer les modifications' : 'Ajouter le bien'}
      </Button>
    </form>
  )
}
