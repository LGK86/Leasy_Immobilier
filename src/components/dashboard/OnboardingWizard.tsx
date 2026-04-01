'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  step: number | null | undefined
  userId: string
  initialProperties: { id: string; address: string; city: string }[]
  onStepComplete: (newStep: number) => void
}

const STEP_LABELS = ['Votre premier bien', 'Votre premier locataire', 'Votre premier bail']

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'studio', label: 'Studio' },
  { value: 'commercial', label: 'Local commercial' },
  { value: 'other', label: 'Autre' },
]

export default function OnboardingWizard({
  open, onClose, step, userId, initialProperties, onStepComplete,
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  const safeStep = typeof step === 'number' && step >= 0 ? step : 0
  const displayStep = Math.min(safeStep, 3)

  // IDs créés dans cette session
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null)
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null)
  const [properties, setProperties] = useState(initialProperties)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setProperties(initialProperties)
  }, [initialProperties])

  // Étape 1 — Bien
  const [prop, setProp] = useState({
    type: 'apartment',
    address: '',
    city: '',
    postal_code: '',
    monthly_rent: '',
    charges: '0',
  })

  // Étape 2 — Locataire
  const [tenant, setTenant] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    property_id: '',
    entry_date: '',
  })

  // Étape 3 — Bail
  const [lease, setLease] = useState({
    start_date: '',
    duration: '12',
    monthly_rent: '',
  })

  const advanceStep = async (newStep: number) => {
    const updates: Record<string, unknown> = { onboarding_step: newStep }
    if (newStep >= 3) updates.onboarding_completed = true
    await supabase.from('profiles').update(updates).eq('id', userId)
    onStepComplete(newStep)
  }

  // Étape 1 : créer le bien
  const handleCreateProperty = async () => {
    if (!prop.address || !prop.monthly_rent) {
      toast.error('Veuillez renseigner l\'adresse et le loyer')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id: userId,
        type: prop.type,
        address: prop.address,
        city: prop.city,
        postal_code: prop.postal_code,
        monthly_rent: parseFloat(prop.monthly_rent),
        charges: parseFloat(prop.charges) || 0,
        status: 'vacant',
      })
      .select('id, address, city')
      .single()
    setLoading(false)
    if (error || !data) { toast.error('Erreur lors de la création du bien'); return }
    setCreatedPropertyId(data.id)
    setProperties(prev => [...prev, data])
    setTenant(t => ({ ...t, property_id: data.id }))
    setLease(l => ({ ...l, monthly_rent: prop.monthly_rent }))
    await advanceStep(1)
    router.refresh()
  }

  // Étape 2 : créer le locataire
  const handleCreateTenant = async () => {
    if (!tenant.first_name || !tenant.last_name) {
      toast.error('Veuillez renseigner le prénom et le nom')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        owner_id: userId,
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        email: tenant.email || null,
        phone: tenant.phone || null,
        property_id: tenant.property_id || null,
        entry_date: tenant.entry_date || null,
        status: 'inactive',
      })
      .select('id')
      .single()
    setLoading(false)
    if (error || !data) { toast.error('Erreur lors de la création du locataire'); return }
    setCreatedTenantId(data.id)
    await advanceStep(2)
    router.refresh()
  }

  // Étape 3 : créer le bail
  const handleCreateLease = async () => {
    setLoading(true)
    const propertyId = createdPropertyId ?? properties[0]?.id ?? null
    const property = properties.find(p => p.id === propertyId)
    const title = `Bail — ${property?.address ?? 'Bien'}`
    const { error } = await supabase
      .from('documents')
      .insert({
        owner_id: userId,
        type: 'lease',
        title,
        property_id: propertyId,
        status: 'draft',
        content: {
          tenant_ids: createdTenantId ? [createdTenantId] : [],
          "Date d'entree": lease.start_date || null,
          duration: lease.duration,
          "Loyer mensuel (hors charges)": lease.monthly_rent,
        },
      })
    setLoading(false)
    if (error) { toast.error('Erreur lors de la création du bail'); return }
    await advanceStep(3)
    router.refresh()
  }

  const handleSkipLease = async () => {
    await advanceStep(3)
  }

  const createdProperty = properties.find(p => p.id === createdPropertyId)
  const leasePropertyId = createdPropertyId ?? properties[0]?.id ?? ''
  const leaseProperty = properties.find(p => p.id === leasePropertyId)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="p-0 gap-0"
        style={{
          width: '520px',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b" style={{ backgroundColor: '#063B26' }}>
          <DialogTitle className="text-base font-semibold" style={{ color: '#CFFF92' }}>
            {displayStep < 3
              ? `Étape ${displayStep + 1}/3 — ${STEP_LABELS[displayStep]}`
              : 'Configuration terminée !'}
          </DialogTitle>
          {displayStep < 3 && (
            <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{ width: `${Math.round(((displayStep + 1) / 3) * 100)}%`, backgroundColor: '#CFFF92' }}
              />
            </div>
          )}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto">

          {/* Étape 1 — Bien */}
          {displayStep === 0 && (
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-500">Commençons par renseigner votre premier bien immobilier.</p>

              <div className="space-y-1">
                <Label>Type de bien</Label>
                <Select
                  value={prop.type}
                  onValueChange={(v: string | null) => setProp(p => ({ ...p, type: v ?? 'apartment' }))}
                >
                  <SelectTrigger className="w-full">
                    {PROPERTY_TYPES.find(t => t.value === prop.type)?.label ?? 'Appartement'}
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Adresse <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="15 rue de la Paix"
                  value={prop.address}
                  onChange={e => setProp(p => ({ ...p, address: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Ville</Label>
                  <Input
                    placeholder="Paris"
                    value={prop.city}
                    onChange={e => setProp(p => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Code postal</Label>
                  <Input
                    placeholder="75001"
                    value={prop.postal_code}
                    onChange={e => setProp(p => ({ ...p, postal_code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Loyer mensuel (€) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    placeholder="800"
                    value={prop.monthly_rent}
                    onChange={e => setProp(p => ({ ...p, monthly_rent: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Charges (€)</Label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={prop.charges}
                    onChange={e => setProp(p => ({ ...p, charges: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateProperty}
                disabled={loading || !prop.address || !prop.monthly_rent}
                className="w-full font-semibold text-[#063B26] mt-2"
                style={{ backgroundColor: '#CFFF92' }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter ce bien →'}
              </Button>
            </div>
          )}

          {/* Étape 2 — Locataire */}
          {displayStep === 1 && (
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-500">Ajoutez votre premier locataire.</p>

              {/* Bien associé */}
              {createdProperty ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">Bien associé : </span>
                  <span className="font-medium text-slate-700">
                    {createdProperty.address}{createdProperty.city ? `, ${createdProperty.city}` : ''}
                  </span>
                </div>
              ) : properties.length > 0 ? (
                <div className="space-y-1">
                  <Label>Bien associé</Label>
                  <Select
                    value={tenant.property_id}
                    onValueChange={(v: string | null) => setTenant(t => ({ ...t, property_id: v ?? '' }))}
                  >
                    <SelectTrigger className="w-full">
                      {properties.find(p => p.id === tenant.property_id)
                        ? `${properties.find(p => p.id === tenant.property_id)!.address}`
                        : 'Sélectionner un bien'}
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Prénom <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Marie"
                    value={tenant.first_name}
                    onChange={e => setTenant(t => ({ ...t, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nom <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Dupont"
                    value={tenant.last_name}
                    onChange={e => setTenant(t => ({ ...t, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="marie.dupont@email.com"
                  value={tenant.email}
                  onChange={e => setTenant(t => ({ ...t, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input
                  placeholder="06 12 34 56 78"
                  value={tenant.phone}
                  onChange={e => setTenant(t => ({ ...t, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Date d&apos;entrée</Label>
                <Input
                  type="date"
                  value={tenant.entry_date}
                  onChange={e => setTenant(t => ({ ...t, entry_date: e.target.value }))}
                />
              </div>

              <Button
                onClick={handleCreateTenant}
                disabled={loading || !tenant.first_name || !tenant.last_name}
                className="w-full font-semibold text-[#063B26] mt-2"
                style={{ backgroundColor: '#CFFF92' }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter ce locataire →'}
              </Button>
            </div>
          )}

          {/* Étape 3 — Bail */}
          {displayStep === 2 && (
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-500">
                Créez le contrat de bail. Vous pourrez le compléter et le faire signer depuis les documents.
              </p>

              {/* Bien */}
              {leaseProperty ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">Bien : </span>
                  <span className="font-medium text-slate-700">
                    {leaseProperty.address}{leaseProperty.city ? `, ${leaseProperty.city}` : ''}
                  </span>
                </div>
              ) : properties.length > 0 ? (
                <div className="space-y-1">
                  <Label>Bien</Label>
                  <Select
                    value={leasePropertyId}
                    onValueChange={(v: string | null) => { if (v) setCreatedPropertyId(v) }}
                  >
                    <SelectTrigger className="w-full">
                      {properties.find(p => p.id === leasePropertyId)?.address ?? 'Sélectionner un bien'}
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1">
                <Label>Date de début du bail</Label>
                <Input
                  type="date"
                  value={lease.start_date}
                  onChange={e => setLease(l => ({ ...l, start_date: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Durée (mois)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={lease.duration}
                    onChange={e => setLease(l => ({ ...l, duration: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Loyer mensuel (€)</Label>
                  <Input
                    type="number"
                    placeholder="800"
                    value={lease.monthly_rent}
                    onChange={e => setLease(l => ({ ...l, monthly_rent: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateLease}
                disabled={loading}
                className="w-full font-semibold text-[#063B26] mt-2"
                style={{ backgroundColor: '#CFFF92' }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer ce bail →'}
              </Button>

              <Button
                variant="ghost"
                onClick={handleSkipLease}
                disabled={loading}
                className="w-full text-slate-500 text-sm"
              >
                Passer cette étape
              </Button>
            </div>
          )}

          {/* Félicitations */}
          {displayStep >= 3 && (
            <div className="flex flex-col items-center text-center gap-6 py-10 px-6">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold" style={{ color: '#063B26' }}>
                Votre espace est configuré !
              </h2>
              <p className="text-gray-600 max-w-sm">
                Vous pouvez maintenant gérer vos biens, locataires, paiements et documents depuis votre tableau de bord.
              </p>
              <Button
                onClick={onClose}
                style={{ backgroundColor: '#CFFF92', color: '#063B26' }}
                className="font-semibold px-8 py-3"
              >
                Accéder au tableau de bord →
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
