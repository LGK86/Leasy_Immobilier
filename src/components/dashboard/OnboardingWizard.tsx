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
import DocumentWizard from '@/components/documents/DocumentWizard'

interface TenantEntry {
  id: string
  first_name: string
  last_name: string
  property_id: string | null
  email: string | null
  phone: string | null
  entry_date?: string | null
}

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
  { value: 'house',     label: 'Maison' },
  { value: 'studio',    label: 'Studio' },
  { value: 'commercial',label: 'Local commercial' },
  { value: 'other',     label: 'Autre' },
]

export default function OnboardingWizard({
  open, onClose, step, userId, initialProperties, onStepComplete,
}: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const safeStep    = typeof step === 'number' && step >= 0 ? step : 0
  const displayStep = Math.min(safeStep, 3)

  // Données créées dans cette session
  const [createdPropertyId, setCreatedPropertyId]   = useState<string | null>(null)
  const [createdTenant, setCreatedTenant]           = useState<TenantEntry | null>(null)
  const [properties, setProperties]                 = useState(initialProperties)
  const [loading, setLoading]                       = useState(false)

  useEffect(() => { setProperties(initialProperties) }, [initialProperties])

  // ── Formulaire étape 1 — Bien ─────────────────────────────────────────────

  const [prop, setProp] = useState({
    type:         'apartment',
    address:      '',
    city:         '',
    postal_code:  '',
    monthly_rent: '',
    charges:      '0',
    deposit:      '0',
    surface:      '',
    rooms_count:  '',
  })

  // ── Formulaire étape 2 — Locataire ────────────────────────────────────────

  const [tenant, setTenant] = useState({
    first_name:  '',
    last_name:   '',
    email:       '',
    phone:       '',
    property_id: '',
    entry_date:  '',
  })

  // ── Helpers ───────────────────────────────────────────────────────────────

  const advanceStep = async (newStep: number) => {
    const updates: Record<string, unknown> = { onboarding_step: newStep }
    if (newStep >= 3) updates.onboarding_completed = true
    await supabase.from('profiles').update(updates).eq('id', userId)
    onStepComplete(newStep)
  }

  // ── Étape 1 : créer le bien ───────────────────────────────────────────────

  const handleCreateProperty = async () => {
    if (!prop.address || !prop.monthly_rent) {
      toast.error('Veuillez renseigner l\'adresse et le loyer')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id:     userId,
        type:         prop.type,
        address:      prop.address,
        city:         prop.city,
        postal_code:  prop.postal_code,
        monthly_rent: parseFloat(prop.monthly_rent),
        charges:      parseFloat(prop.charges)     || 0,
        deposit:      parseFloat(prop.deposit)     || 0,
        surface:      prop.surface     ? parseFloat(prop.surface)     : null,
        rooms_count:  prop.rooms_count ? parseInt(prop.rooms_count)   : null,
        status:       'vacant',
      })
      .select('id, address, city')
      .single()
    setLoading(false)
    if (error || !data) { toast.error('Erreur lors de la création du bien'); return }
    setCreatedPropertyId(data.id)
    setProperties(prev => [...prev, data])
    setTenant(t => ({ ...t, property_id: data.id }))
    await advanceStep(1)
    router.refresh()
  }

  // ── Étape 2 : créer le locataire ──────────────────────────────────────────

  const handleCreateTenant = async () => {
    if (!tenant.first_name || !tenant.last_name) {
      toast.error('Veuillez renseigner le prénom et le nom')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        owner_id:    userId,
        first_name:  tenant.first_name,
        last_name:   tenant.last_name,
        email:       tenant.email      || null,
        phone:       tenant.phone      || null,
        property_id: tenant.property_id || null,
        entry_date:  tenant.entry_date  || null,
        status:      'inactive',
      })
      .select('id')
      .single()
    setLoading(false)
    if (error || !data) { toast.error('Erreur lors de la création du locataire'); return }
    setCreatedTenant({
      id:          data.id,
      first_name:  tenant.first_name,
      last_name:   tenant.last_name,
      property_id: tenant.property_id || null,
      email:       tenant.email       || null,
      phone:       tenant.phone       || null,
      entry_date:  tenant.entry_date  || null,
    })
    await advanceStep(2)
    router.refresh()
  }

  // ── Étape 3 : bail via DocumentWizard ─────────────────────────────────────

  const handleLeaseComplete = async () => {
    await advanceStep(3)
    router.refresh()
  }

  const handleSkipLease = async () => {
    await advanceStep(3)
  }

  // ── Données dérivées ──────────────────────────────────────────────────────

  const createdProperty    = properties.find(p => p.id === createdPropertyId)
  const leasePropertyId    = createdPropertyId ?? properties[0]?.id ?? undefined
  const tenantEntry        = createdTenant
    ? [createdTenant]
    : []

  // Doc pré-rempli passé au DocumentWizard (type lease, id null pour mode création)
  const prefilledLeaseDoc = displayStep === 2 ? {
    type:        'lease',
    id:          null,
    property_id: leasePropertyId ?? null,
    content: {
      tenant_ids:     createdTenant ? [createdTenant.id] : [],
      "Date d'entree": createdTenant?.entry_date || '',
    },
  } : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="p-0 gap-0"
        style={{
          width:     '520px',
          maxWidth:  '520px',
          maxHeight: '90vh',
          overflow:  'hidden',
          display:   'flex',
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

        {/* Corps — overflow-hidden à l'étape 3 car DocumentWizard gère son propre scroll */}
        <div className={`flex-1 ${displayStep === 2 ? 'overflow-hidden' : 'overflow-y-auto'}`}>

          {/* ── Étape 1 — Bien ─────────────────────────────────────────────── */}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Dépôt de garantie (€)</Label>
                  <Input
                    type="number"
                    placeholder="800"
                    value={prop.deposit}
                    onChange={e => setProp(p => ({ ...p, deposit: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Surface (m²)</Label>
                  <Input
                    type="number"
                    placeholder="45"
                    value={prop.surface}
                    onChange={e => setProp(p => ({ ...p, surface: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Nombre de pièces</Label>
                <Input
                  type="number"
                  placeholder="2"
                  value={prop.rooms_count}
                  onChange={e => setProp(p => ({ ...p, rooms_count: e.target.value }))}
                />
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

          {/* ── Étape 2 — Locataire ────────────────────────────────────────── */}
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
                      {properties.find(p => p.id === tenant.property_id)?.address ?? 'Sélectionner un bien'}
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

          {/* ── Étape 3 — DocumentWizard bail ─────────────────────────────── */}
          {displayStep === 2 && prefilledLeaseDoc && (
            <DocumentWizard
              doc={prefilledLeaseDoc}
              properties={properties}
              tenants={tenantEntry}
              userId={userId}
              preselectedPropertyId={leasePropertyId}
              preselectedTenantId={createdTenant?.id}
              onComplete={handleLeaseComplete}
              onSkip={handleSkipLease}
              isEmbedded
            />
          )}

          {/* ── Félicitations ──────────────────────────────────────────────── */}
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
