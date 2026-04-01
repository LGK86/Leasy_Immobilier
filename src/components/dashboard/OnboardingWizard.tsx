'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Loader2, X, Plus } from 'lucide-react'
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
  { value: 'apartment',  label: 'Appartement' },
  { value: 'house',      label: 'Maison' },
  { value: 'studio',     label: 'Studio' },
  { value: 'commercial', label: 'Local commercial' },
  { value: 'other',      label: 'Autre' },
]

const EMPTY_TENANT_FORM = {
  first_name:  '',
  last_name:   '',
  email:       '',
  phone:       '',
  property_id: '',
  entry_date:  '',
}

export default function OnboardingWizard({
  open, onClose, step, userId, initialProperties, onStepComplete,
}: Props) {
  const supabase = createClient()
  const router   = useRouter()

  const safeStep    = typeof step === 'number' && step >= 0 ? step : 0
  const displayStep = Math.min(safeStep, 3)

  // ── State ─────────────────────────────────────────────────────────────────

  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null)
  const [createdTenants, setCreatedTenants]       = useState<TenantEntry[]>([])
  const [properties, setProperties]               = useState(initialProperties)
  const [loading, setLoading]                     = useState(false)
  const [leaseCreated, setLeaseCreated]           = useState(false)

  // Formulaire étape 1 — Bien
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

  // Formulaire étape 2 — Locataire (inline)
  const [tenantForm, setTenantForm]     = useState({ ...EMPTY_TENANT_FORM })
  const [showTenantForm, setShowTenantForm] = useState(true)

  useEffect(() => { setProperties(initialProperties) }, [initialProperties])

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
        charges:      parseFloat(prop.charges)    || 0,
        deposit:      parseFloat(prop.deposit)    || 0,
        surface:      prop.surface     ? parseFloat(prop.surface)   : null,
        rooms_count:  prop.rooms_count ? parseInt(prop.rooms_count) : null,
        status:       'vacant',
      })
      .select('id, address, city')
      .single()
    setLoading(false)
    if (error || !data) { toast.error('Erreur lors de la création du bien'); return }
    setCreatedPropertyId(data.id)
    setProperties(prev => [...prev, data])
    setTenantForm(f => ({ ...f, property_id: data.id }))
    await advanceStep(1)
    router.refresh()
  }

  // ── Étape 2 : ajouter un locataire ────────────────────────────────────────

  const handleAddTenant = async () => {
    if (!tenantForm.first_name || !tenantForm.last_name) {
      toast.error('Veuillez renseigner le prénom et le nom')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        owner_id:    userId,
        first_name:  tenantForm.first_name,
        last_name:   tenantForm.last_name,
        email:       tenantForm.email      || null,
        phone:       tenantForm.phone      || null,
        property_id: tenantForm.property_id || null,
        entry_date:  tenantForm.entry_date  || null,
        status:      'inactive',
      })
      .select('id')
      .single()
    setLoading(false)
    if (error || !data) { toast.error('Erreur lors de la création du locataire'); return }
    const added: TenantEntry = {
      id:          data.id,
      first_name:  tenantForm.first_name,
      last_name:   tenantForm.last_name,
      property_id: tenantForm.property_id || null,
      email:       tenantForm.email       || null,
      phone:       tenantForm.phone       || null,
      entry_date:  tenantForm.entry_date  || null,
    }
    setCreatedTenants(prev => [...prev, added])
    // Réinitialiser le formulaire (garder le bien associé)
    setTenantForm({ ...EMPTY_TENANT_FORM, property_id: tenantForm.property_id })
    setShowTenantForm(false)
    toast.success(`${tenantForm.first_name} ${tenantForm.last_name} ajouté`)
    router.refresh()
  }

  const handleContinueStep2 = async () => {
    if (createdTenants.length === 0) {
      toast.error('Ajoutez au moins un locataire pour continuer')
      return
    }
    await advanceStep(2)
  }

  // ── Étape 3 : bail via DocumentWizard ─────────────────────────────────────

  const handleLeaseComplete = async () => {
    setLeaseCreated(true)
    await advanceStep(3)
    router.refresh()
  }

  const handleSkipLease = async () => {
    setLeaseCreated(false)
    await advanceStep(3)
  }

  // ── Données dérivées ──────────────────────────────────────────────────────

  const createdProperty = properties.find(p => p.id === createdPropertyId)
  const leasePropertyId = createdPropertyId ?? properties[0]?.id ?? undefined
  const firstTenant     = createdTenants[0] ?? null

  const prefilledLeaseDoc = displayStep === 2 ? {
    type:        'lease',
    id:          null,
    property_id: leasePropertyId ?? null,
    content: {
      tenant_ids:      createdTenants.map(t => t.id),
      "Date d'entree": firstTenant?.entry_date || '',
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

        {/* Corps */}
        <div className={`flex-1 ${displayStep === 2 ? 'overflow-hidden' : 'overflow-y-auto'}`}>

          {/* ── Étape 1 — Bien ─────────────────────────────────────────────── */}
          {displayStep === 0 && (
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-500">Commençons par renseigner votre premier bien immobilier.</p>

              {/* Type */}
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

              {/* Adresse */}
              <div className="space-y-1">
                <Label>Adresse <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="15 rue de la Paix"
                  value={prop.address}
                  onChange={e => setProp(p => ({ ...p, address: e.target.value }))}
                />
              </div>

              {/* Ville + Code postal */}
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

              {/* Loyer + Charges */}
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

              {/* Dépôt + Surface */}
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

              {/* Nombre de pièces */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nombre de pièces</Label>
                  <Input
                    type="number"
                    placeholder="2"
                    value={prop.rooms_count}
                    onChange={e => setProp(p => ({ ...p, rooms_count: e.target.value }))}
                  />
                </div>
                <div /> {/* Colonne vide pour l'alignement */}
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

          {/* ── Étape 2 — Locataires ───────────────────────────────────────── */}
          {displayStep === 1 && (
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-500">Ajoutez les locataires pour ce bien.</p>

              {/* Bien associé */}
              {createdProperty ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">Bien : </span>
                  <span className="font-medium text-slate-700">
                    {createdProperty.address}{createdProperty.city ? `, ${createdProperty.city}` : ''}
                  </span>
                </div>
              ) : properties.length > 0 ? (
                <div className="space-y-1">
                  <Label>Bien associé</Label>
                  <Select
                    value={tenantForm.property_id}
                    onValueChange={(v: string | null) => setTenantForm(f => ({ ...f, property_id: v ?? '' }))}
                  >
                    <SelectTrigger className="w-full">
                      {properties.find(p => p.id === tenantForm.property_id)?.address ?? 'Sélectionner un bien'}
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {/* Badges des locataires ajoutés */}
              {createdTenants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {createdTenants.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
                      style={{ backgroundColor: 'rgba(6,59,38,0.1)', color: '#063B26' }}
                    >
                      <span>{t.first_name} {t.last_name}</span>
                      <button
                        onClick={() => setCreatedTenants(prev => prev.filter(x => x.id !== t.id))}
                        className="hover:opacity-60 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulaire inline */}
              {showTenantForm ? (
                <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Prénom <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Marie"
                        value={tenantForm.first_name}
                        onChange={e => setTenantForm(f => ({ ...f, first_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nom <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Dupont"
                        value={tenantForm.last_name}
                        onChange={e => setTenantForm(f => ({ ...f, last_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      placeholder="marie.dupont@email.com"
                      value={tenantForm.email}
                      onChange={e => setTenantForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Téléphone</Label>
                      <Input
                        placeholder="06 12 34 56 78"
                        value={tenantForm.phone}
                        onChange={e => setTenantForm(f => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date d&apos;entrée</Label>
                      <Input
                        type="date"
                        value={tenantForm.entry_date}
                        onChange={e => setTenantForm(f => ({ ...f, entry_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddTenant}
                      disabled={loading || !tenantForm.first_name || !tenantForm.last_name}
                      size="sm"
                      className="font-semibold text-[#063B26]"
                      style={{ backgroundColor: '#CFFF92' }}
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ajouter'}
                    </Button>
                    {createdTenants.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTenantForm(false)}
                        className="text-slate-500"
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTenantForm(true)}
                  className="flex items-center gap-1.5 text-slate-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un autre locataire
                </Button>
              )}

              {/* Bouton Continuer */}
              <Button
                onClick={handleContinueStep2}
                disabled={loading || createdTenants.length === 0}
                className="w-full font-semibold text-[#063B26] mt-2"
                style={{ backgroundColor: '#CFFF92' }}
              >
                Continuer →
              </Button>
              {createdTenants.length === 0 && (
                <p className="text-xs text-slate-400 text-center">Ajoutez au moins un locataire pour continuer</p>
              )}
            </div>
          )}

          {/* ── Étape 3 — DocumentWizard bail ─────────────────────────────── */}
          {displayStep === 2 && prefilledLeaseDoc && (
            <DocumentWizard
              doc={prefilledLeaseDoc}
              properties={properties}
              tenants={createdTenants}
              userId={userId}
              preselectedPropertyId={leasePropertyId}
              preselectedTenantId={firstTenant?.id}
              onComplete={handleLeaseComplete}
              onSkip={handleSkipLease}
              isEmbedded
            />
          )}

          {/* ── Félicitations ──────────────────────────────────────────────── */}
          {displayStep >= 3 && (
            <div className="flex flex-col items-center text-center gap-5 py-10 px-6">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold" style={{ color: '#063B26' }}>
                Votre espace est configuré !
              </h2>
              <p className="text-gray-600 max-w-sm">
                Vous pouvez maintenant gérer vos biens, locataires, paiements et documents depuis votre tableau de bord.
              </p>
              {leaseCreated && (
                <div
                  className="rounded-lg p-4 text-sm text-left w-full max-w-sm"
                  style={{ backgroundColor: 'rgba(6,59,38,0.08)', border: '1px solid rgba(6,59,38,0.2)', color: '#063B26' }}
                >
                  📄 Retrouvez votre bail prêt pour signature dans votre espace <strong>Mes documents</strong>.
                </div>
              )}
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
