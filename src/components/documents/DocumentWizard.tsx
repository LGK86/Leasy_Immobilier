'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, Trash2, User, Building, X, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type KeyEntry     = { type: string; destination: string; nombre: string }
type ElementState = { etat: string; desc: string }
type PiecesState  = Record<string, Record<string, ElementState>>
type InventoryRow = { objet: string; quantite: string; etat: string; commentaires: string }
type TenantEntry  = { id: string; first_name: string; last_name: string; property_id: string | null; email?: string | null; phone?: string | null }

interface Props {
  doc: any | null
  onSave: (content: Record<string, string>) => void
  onDocCreated?: (doc: any) => void
  properties?: { id: string; address: string; city: string }[]
  tenants?: TenantEntry[]
  userId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ETATS_OPTIONS = [
  { value: 'A',  label: 'A — Très bon' },
  { value: 'B',  label: 'B — Bon' },
  { value: 'C',  label: 'C — Passable' },
  { value: 'D',  label: 'D — Mauvais' },
  { value: 'HS', label: 'HS — Hors service' },
  { value: 'NV', label: 'NV — Non vérifié' },
]

const ROOMS: { key: string; label: string }[] = [
  { key: 'Entree',        label: 'Entrée' },
  { key: 'Sejour',        label: 'Séjour' },
  { key: 'Cuisine',       label: 'Cuisine' },
  { key: 'Salle_de_bain', label: 'Salle de bain' },
  { key: 'Chambre',       label: 'Chambre' },
  { key: 'Dressing',      label: 'Dressing' },
]

const ELEMENTS: { key: string; label: string }[] = [
  { key: 'Murs',        label: 'Murs' },
  { key: 'Sol',         label: 'Sol' },
  { key: 'Plafond',     label: 'Plafond' },
  { key: 'Fenetres',    label: 'Fenêtres' },
  { key: 'Porte',       label: 'Porte' },
  { key: 'Electricite', label: 'Électricité' },
]

const INVENTORY_ROOMS: { key: string; label: string }[] = [
  { key: 'Sejour',  label: 'Séjour / Salle à manger' },
  { key: 'Cuisine', label: 'Cuisine' },
  { key: 'Chambre', label: 'Chambre' },
  { key: 'Autres',  label: 'Autres pièces' },
]

// ─── Section definitions ──────────────────────────────────────────────────────

function getSections(type: string): string[] {
  if (type === 'lease') {
    return ['Le bien', 'Les locataires', 'Parties', 'Le logement', 'Durée', 'Finances', 'Services', 'Conditions']
  }
  if (type === 'entry_inspection' || type === 'exit_inspection') {
    return ['Parties', 'Locaux', 'Accès', 'Accessoires', 'Chauffage', 'Compteurs', 'État des pièces', 'Observations']
  }
  if (type === 'inventory') {
    return ['Parties', 'Séjour', 'Cuisine', 'Chambre', 'Autres', 'Observations']
  }
  return ['Informations']
}

// ─── State initializers ───────────────────────────────────────────────────────

function initTenantIds(content: any): string[] {
  if (!content) return []
  const raw = content.tenant_ids
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) return raw.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}

function initKeyEntries(content: Record<string, string>): KeyEntry[] {
  try { if (content['acces']) return JSON.parse(content['acces']) } catch {}
  return [{ type: '', destination: '', nombre: '1' }]
}

function initPiecesState(content: Record<string, string>): PiecesState {
  try { if (content['etat_pieces']) return JSON.parse(content['etat_pieces']) } catch {}
  const state: PiecesState = {}
  for (const r of ROOMS) {
    state[r.key] = {}
    for (const el of ELEMENTS) state[r.key][el.key] = { etat: 'B', desc: '' }
  }
  return state
}

function initInventoryRows(content: Record<string, string>): Record<string, InventoryRow[]> {
  const rows: Record<string, InventoryRow[]> = {}
  for (const r of INVENTORY_ROOMS) {
    try {
      const raw = content[`mobilier_${r.key}`]
      if (raw) { rows[r.key] = JSON.parse(raw); continue }
    } catch {}
    rows[r.key] = [{ objet: '', quantite: '1', etat: 'Bon', commentaires: '' }]
  }
  return rows
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function LF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function TF({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <LF label={label}>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </LF>
  )
}

function SF({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  const found = options.find(o => o.value === value)
  return (
    <LF label={label}>
      <Select value={value || undefined} onValueChange={(v: string | null) => onChange(v ?? '')}>
        <SelectTrigger className="w-full">
          <span className="flex-1 text-left truncate text-sm">
            {found ? found.label : <span className="text-muted-foreground">Sélectionner</span>}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </LF>
  )
}

function TA({ label, value, onChange, rows = 4, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <LF label={label}>
      <textarea
        value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </LF>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentWizard({ doc, onSave, onDocCreated, properties = [], tenants = [], userId }: Props) {
  const supabase = createClient()
  const docType = doc?.type ?? 'lease'

  const flatContent = (): Record<string, string> => {
    const c = doc?.content ?? {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(c)) {
      if (!['tenant_ids', 'rent_split', 'acces', 'etat_pieces'].includes(k) && !k.startsWith('mobilier_')) {
        out[k] = Array.isArray(v) ? (v as string[]).join(',') : String(v ?? '')
      }
    }
    return out
  }

  const [section, setSection] = useState(1)
  const [form, setForm]       = useState<Record<string, string>>(flatContent)

  // Lease-specific state
  const [docId, setDocId]               = useState<string | null>(doc?.id ?? null)
  const [propertyId, setPropertyId]     = useState<string | null>(doc?.property_id ?? null)
  const [tenantIds, setTenantIds]       = useState<string[]>(() => initTenantIds(doc?.content))
  const [localTenants, setLocalTenants] = useState<TenantEntry[]>(tenants)
  const [splitRent, setSplitRent]       = useState(false)
  const [rentSplit, setRentSplit]       = useState<Record<string, number>>({})

  // Inline new tenant form
  const [localProperties, setLocalProperties] = useState<{ id: string; address: string; city: string }[]>(properties)
  const [showNewProperty, setShowNewProperty]   = useState(false)
  const [newPropertyForm, setNewPropertyForm]   = useState({ address: '', postal_code: '', city: '', type: 'apartment', monthly_rent: '', charges: '', deposit: '' })
  const [creatingProperty, setCreatingProperty] = useState(false)

  const [showNewTenant, setShowNewTenant]   = useState(false)
  const [newTenantForm, setNewTenantForm]   = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [creatingTenant, setCreatingTenant] = useState(false)
  const [creatingDoc, setCreatingDoc]       = useState(false)

  // Non-lease: fetched for Parties display
  const [tenantDetails, setTenantDetails] = useState<any[]>([])
  const [profile, setProfile]             = useState<any>(null)
  const [loadingData, setLoadingData]     = useState(true)

  // Complex section state
  const [keyEntries,    setKeyEntries]    = useState<KeyEntry[]>(() => initKeyEntries(doc?.content ?? {}))
  const [piecesState,   setPiecesState]   = useState<PiecesState>(() => initPiecesState(doc?.content ?? {}))
  const [inventoryRows, setInventoryRows] = useState<Record<string, InventoryRow[]>>(() => initInventoryRows(doc?.content ?? {}))

  const sections = getSections(docType)
  const total    = sections.length

  useEffect(() => {
    const load = async () => {
      setLoadingData(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(prof)
      }
      if (docType !== 'lease') {
        const rawIds = doc?.content?.tenant_ids
        let ids: string[] = []
        if (Array.isArray(rawIds)) ids = rawIds
        else if (typeof rawIds === 'string' && rawIds) ids = rawIds.split(',').map((s: string) => s.trim()).filter(Boolean)
        if (ids.length > 0) {
          const { data } = await supabase.from('tenants').select('id, first_name, last_name, email, phone').in('id', ids)
          setTenantDetails(data ?? [])
        }
      }
      setLoadingData(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { setLocalTenants(tenants) }, [tenants])

  const f = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }))

  // ── Rent split ────────────────────────────────────────────────────────────

  const updateRentSplit = (ids?: string[], rentAmount?: number) => {
    const currentIds = ids ?? tenantIds
    const total = Math.round(rentAmount ?? (parseFloat(form['Loyer mensuel (€)'] ?? '0') || 0))
    if (currentIds.length === 0 || total === 0) return
    const base = Math.floor(total / currentIds.length)
    const rem  = total - base * currentIds.length
    const split: Record<string, number> = {}
    currentIds.forEach((id, i) => { split[id] = i === 0 ? base + rem : base })
    setRentSplit(split)
  }

  const handleSplitChange = (changedId: string, newAmount: number) => {
    const total = parseFloat(form['Loyer mensuel (€)'] ?? '0') || 0
    const otherIds = tenantIds.filter(id => id !== changedId)
    const newSplit = { ...rentSplit, [changedId]: newAmount }
    if (otherIds.length === 1) {
      newSplit[otherIds[0]] = Math.max(0, total - newAmount)
    } else if (otherIds.length > 1) {
      const remaining = total - newAmount
      const base = Math.floor(remaining / otherIds.length)
      const rem  = remaining - base * otherIds.length
      otherIds.forEach((id, i) => { newSplit[id] = Math.max(0, i === 0 ? base + rem : base) })
    }
    setRentSplit(newSplit)
  }

  // ── Tenant management ─────────────────────────────────────────────────────

  const addTenant = (id: string) => {
    if (!id || tenantIds.includes(id)) return
    const newIds = [...tenantIds, id]
    setTenantIds(newIds)
    if (splitRent) updateRentSplit(newIds)
  }

  const removeTenant = (id: string) => {
    const newIds = tenantIds.filter(t => t !== id)
    setTenantIds(newIds)
    if (splitRent) updateRentSplit(newIds)
  }

  const handleCreateTenant = async () => {
    if (!newTenantForm.first_name || !newTenantForm.last_name || !newTenantForm.email) return
    setCreatingTenant(true)
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        owner_id: userId,
        first_name: newTenantForm.first_name,
        last_name: newTenantForm.last_name,
        email: newTenantForm.email,
        phone: newTenantForm.phone || null,
        property_id: propertyId || null,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .select('id, first_name, last_name, property_id, email, phone')
      .single()

    if (!error && data) {
      const entry: TenantEntry = { ...data, property_id: data.property_id ?? null }
      setLocalTenants(prev => [...prev, entry])
      addTenant(data.id)
      setNewTenantForm({ first_name: '', last_name: '', email: '', phone: '' })
      setShowNewTenant(false)
    }
    setCreatingTenant(false)
  }

  // ── Property creation ─────────────────────────────────────────────────────

  const handleCreateProperty = async () => {
    if (!newPropertyForm.address || !newPropertyForm.city) return
    setCreatingProperty(true)
    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id: userId,
        address: newPropertyForm.address,
        postal_code: newPropertyForm.postal_code || null,
        city: newPropertyForm.city,
        type: newPropertyForm.type,
        monthly_rent: parseFloat(newPropertyForm.monthly_rent) || 0,
        charges: parseFloat(newPropertyForm.charges) || 0,
        deposit: parseFloat(newPropertyForm.deposit) || 0,
        status: 'vacant',
      })
      .select('id, address, city')
      .single()
    setCreatingProperty(false)
    if (error || !data) { toast.error('Erreur : ' + error?.message); return }
    setLocalProperties(prev => [...prev, data])
    setPropertyId(data.id)
    setForm(prev => ({
      ...prev,
      'Loyer mensuel (€)': newPropertyForm.monthly_rent,
      'Charges (€)':       newPropertyForm.charges,
      'Depot de garantie (€)': newPropertyForm.deposit,
    }))
    setNewPropertyForm({ address: '', postal_code: '', city: '', type: 'apartment', monthly_rent: '', charges: '', deposit: '' })
    setShowNewProperty(false)
  }

  // ── Property selection ────────────────────────────────────────────────────

  const handlePropertyChange = async (id: string | null) => {
    setPropertyId(id)
    if (!id) return
    const { data } = await supabase
      .from('properties')
      .select('monthly_rent, charges, deposit, surface, rooms_count')
      .eq('id', id)
      .single()
    if (data) {
      setForm(prev => ({
        ...prev,
        'Loyer mensuel (€)':     String(data.monthly_rent ?? ''),
        'Charges (€)':           String(data.charges ?? ''),
        'Depot de garantie (€)': String(data.deposit ?? ''),
        ...(data.surface != null    ? { 'Surface habitable': String(data.surface) }    : {}),
        ...(data.rooms_count != null ? { 'Nombre de pieces': String(data.rooms_count) } : {}),
      }))
      if (splitRent) updateRentSplit(tenantIds, data.monthly_rent)
    }
  }

  // ── Auto-save (fire and forget) ───────────────────────────────────────────

  const autoSave = () => {
    const id = docId || doc?.id
    if (!id) return
    const contentForSave: Record<string, unknown> = { ...form }
    if (docType === 'lease') {
      contentForSave['tenant_ids'] = tenantIds
      if (splitRent && Object.keys(rentSplit).length > 0) {
        contentForSave['rent_split'] = JSON.stringify(rentSplit)
      }
    } else if (docType === 'entry_inspection' || docType === 'exit_inspection') {
      contentForSave['acces']       = JSON.stringify(keyEntries)
      contentForSave['etat_pieces'] = JSON.stringify(piecesState)
    } else if (docType === 'inventory') {
      for (const r of INVENTORY_ROOMS) {
        contentForSave[`mobilier_${r.key}`] = JSON.stringify(inventoryRows[r.key] ?? [])
      }
    }
    const updates: Record<string, unknown> = { content: contentForSave, updated_at: new Date().toISOString() }
    if (docType === 'lease') {
      updates.property_id = propertyId || null
      updates.tenant_id   = tenantIds[0] || null
    }
    supabase.from('documents').update(updates).eq('id', id).then(() => {})
  }

  const buildFinalContent = (): Record<string, string> => {
    const out: Record<string, string> = { ...form }
    if (docType === 'lease') {
      out['tenant_ids'] = tenantIds.join(',')
      if (splitRent && Object.keys(rentSplit).length > 0) {
        out['rent_split'] = JSON.stringify(rentSplit)
      }
    } else if (docType === 'entry_inspection' || docType === 'exit_inspection') {
      out['acces']       = JSON.stringify(keyEntries)
      out['etat_pieces'] = JSON.stringify(piecesState)
    } else if (docType === 'inventory') {
      for (const r of INVENTORY_ROOMS) {
        out[`mobilier_${r.key}`] = JSON.stringify(inventoryRows[r.key] ?? [])
      }
    }
    return out
  }

  const canProceed = (): boolean => {
    if (docType === 'lease') {
      if (section === 1) return !!propertyId
      if (section === 2) return tenantIds.length > 0
    }
    return true
  }

  const handleNext = async () => {
    // In creation mode (no doc yet): create the doc at end of section 1 (Le bien)
    if (!docId && !doc?.id && section === 1 && docType === 'lease') {
      if (!propertyId) return
      setCreatingDoc(true)
      const { data: newDoc, error } = await supabase
        .from('documents')
        .insert({ owner_id: userId, type: 'lease', title: 'Contrat de bail', content: {}, status: 'draft', property_id: propertyId })
        .select('*, property:properties(*), tenant:tenants(*)')
        .single()
      setCreatingDoc(false)
      if (error || !newDoc) { toast.error('Erreur lors de la création'); return }
      setDocId(newDoc.id)
      onDocCreated?.(newDoc)
      setSection(s => s + 1)
      return
    }
    autoSave()
    if (section < total) setSection(s => s + 1)
    else onSave(buildFinalContent())
  }

  // ── Progress bar ──────────────────────────────────────────────────────────

  const Progress = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400">Section {section} / {total}</span>
        <span className="text-xs font-medium text-slate-700">{sections[section - 1]}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(section / total) * 100}%`, backgroundColor: '#063B26' }} />
      </div>
      <div className="flex gap-0.5 mt-1.5">
        {sections.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-200"
            style={{ backgroundColor: i + 1 <= section ? '#063B26' : '#e2e8f0' }} />
        ))}
      </div>
    </div>
  )

  // ── Nav ───────────────────────────────────────────────────────────────────

  const Nav = () => (
    <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
      {section > 1 && (
        <Button variant="outline" size="sm" onClick={() => setSection(s => s - 1)} className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
      )}
      <Button size="sm" onClick={handleNext} disabled={!canProceed() || creatingDoc}
        className="ml-auto flex items-center gap-1 text-[#063B26] font-semibold disabled:opacity-50"
        style={{ backgroundColor: '#CFFF92' }}
      >
        {section < total ? <>Suivant <ChevronRight className="h-4 w-4" /></> : 'Enregistrer et continuer'}
      </Button>
    </div>
  )

  // ── Shared: Parties ───────────────────────────────────────────────────────

  const renderParties = () => {
    const displayTenants = docType === 'lease'
      ? localTenants.filter(t => tenantIds.includes(t.id))
      : tenantDetails
    const selectedProp = docType === 'lease'
      ? localProperties.find(p => p.id === propertyId)
      : doc?.property

    return (
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bailleur</span>
          </div>
          {loadingData ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : profile ? (
            <div className="space-y-0.5 text-sm">
              <p className="font-medium text-slate-700">{profile.first_name} {profile.last_name}</p>
              {profile.address && <p className="text-slate-500">{profile.address}{profile.postal_code ? `, ${profile.postal_code}` : ''}{profile.city ? ` ${profile.city}` : ''}</p>}
              {profile.email && <p className="text-slate-500">{profile.email}</p>}
              {profile.phone && <p className="text-slate-500">{profile.phone}</p>}
            </div>
          ) : <p className="text-sm text-slate-400">Profil non renseigné</p>}
        </div>

        {selectedProp && (
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Le bien</span>
            </div>
            <p className="text-sm font-medium text-slate-700">{selectedProp.address}, {selectedProp.city}</p>
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {displayTenants.length > 1 ? 'Locataires' : 'Locataire'}
            </span>
          </div>
          {loadingData ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : displayTenants.length > 0 ? (
            <div className="space-y-2">
              {displayTenants.map((t: any) => (
                <div key={t.id} className="space-y-0.5 text-sm">
                  <p className="font-medium text-slate-700">{t.first_name} {t.last_name}</p>
                  {t.email && <p className="text-slate-500">{t.email}</p>}
                  {t.phone && <p className="text-slate-500">{t.phone}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Aucun locataire associé</p>}
        </div>
      </div>
    )
  }

  // ── LEASE: Le bien ────────────────────────────────────────────────────────

  const renderLeBien = () => {
    const selectedProp = localProperties.find(p => p.id === propertyId)
    return (
      <div className="space-y-4">
        {localProperties.length > 0 && (
          <LF label="Sélectionner le bien">
            <Select value={propertyId || undefined} onValueChange={handlePropertyChange}>
              <SelectTrigger className="w-full">
                <span className="flex-1 text-left truncate text-sm">
                  {selectedProp
                    ? `${selectedProp.address}, ${selectedProp.city}`
                    : <span className="text-muted-foreground">Choisir un bien</span>}
                </span>
              </SelectTrigger>
              <SelectContent>
                {localProperties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LF>
        )}

        {selectedProp && (
          <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-3 text-sm text-emerald-700">
            <Building className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            {selectedProp.address}, {selectedProp.city}
          </div>
        )}

        {showNewProperty ? (
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600">Nouveau bien</p>
            <TF label="Adresse *"    value={newPropertyForm.address}     onChange={v => setNewPropertyForm(f => ({ ...f, address: v }))}     placeholder="12 rue de la Paix" />
            <div className="grid grid-cols-2 gap-2">
              <TF label="Code postal" value={newPropertyForm.postal_code} onChange={v => setNewPropertyForm(f => ({ ...f, postal_code: v }))} placeholder="75001" />
              <TF label="Ville *"     value={newPropertyForm.city}        onChange={v => setNewPropertyForm(f => ({ ...f, city: v }))}        placeholder="Paris" />
            </div>
            <SF label="Type de bien" value={newPropertyForm.type} onChange={v => setNewPropertyForm(f => ({ ...f, type: v }))}
              options={[
                { value: 'apartment', label: 'Appartement' },
                { value: 'house',     label: 'Maison' },
                { value: 'studio',    label: 'Studio' },
                { value: 'room',      label: 'Chambre' },
                { value: 'other',     label: 'Autre' },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              <TF label="Loyer (€)"   value={newPropertyForm.monthly_rent} onChange={v => setNewPropertyForm(f => ({ ...f, monthly_rent: v }))} placeholder="800" />
              <TF label="Charges (€)" value={newPropertyForm.charges}      onChange={v => setNewPropertyForm(f => ({ ...f, charges: v }))}      placeholder="50" />
              <TF label="Dépôt (€)"   value={newPropertyForm.deposit}      onChange={v => setNewPropertyForm(f => ({ ...f, deposit: v }))}      placeholder="800" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewProperty(false)}>Annuler</Button>
              <Button type="button" size="sm" onClick={handleCreateProperty}
                disabled={creatingProperty || !newPropertyForm.address || !newPropertyForm.city}
                className="text-[#063B26] font-semibold" style={{ backgroundColor: '#CFFF92' }}
              >
                {creatingProperty ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Créer et sélectionner
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewProperty(true); setPropertyId(null) }} className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nouveau bien
          </Button>
        )}

        {!propertyId && !showNewProperty && <p className="text-xs text-slate-400">Sélectionnez ou créez un bien pour continuer</p>}
      </div>
    )
  }

  // ── LEASE: Les locataires ─────────────────────────────────────────────────

  const renderLocataires = () => {
    const selected  = localTenants.filter(t => tenantIds.includes(t.id))
    const available = localTenants.filter(t =>
      !tenantIds.includes(t.id) && (!propertyId || t.property_id === propertyId || !t.property_id)
    )
    return (
      <div className="space-y-4">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full px-3 py-1.5 text-sm">
                <span>{t.first_name} {t.last_name}</span>
                <button type="button" onClick={() => removeTenant(t.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {available.length > 0 && (
          <LF label="Ajouter un locataire existant">
            <Select value={undefined} onValueChange={(v: string | null | undefined) => { if (v) addTenant(v) }}>
              <SelectTrigger className="w-full">
                <span className="flex-1 text-left text-sm text-muted-foreground">Sélectionner un locataire</span>
              </SelectTrigger>
              <SelectContent>
                {available.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LF>
        )}

        {showNewTenant ? (
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600">Nouveau locataire</p>
            <div className="grid grid-cols-2 gap-2">
              <TF label="Prénom *" value={newTenantForm.first_name} onChange={v => setNewTenantForm(f => ({ ...f, first_name: v }))} placeholder="Jean" />
              <TF label="Nom *"    value={newTenantForm.last_name}  onChange={v => setNewTenantForm(f => ({ ...f, last_name: v }))}  placeholder="Dupont" />
            </div>
            <TF label="Email *"   value={newTenantForm.email} onChange={v => setNewTenantForm(f => ({ ...f, email: v }))} type="email" placeholder="jean@exemple.com" />
            <TF label="Téléphone" value={newTenantForm.phone} onChange={v => setNewTenantForm(f => ({ ...f, phone: v }))} placeholder="Optionnel" />
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewTenant(false)}>Annuler</Button>
              <Button type="button" size="sm" onClick={handleCreateTenant}
                disabled={creatingTenant || !newTenantForm.first_name || !newTenantForm.last_name || !newTenantForm.email}
                className="text-[#063B26] font-semibold" style={{ backgroundColor: '#CFFF92' }}
              >
                {creatingTenant ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Créer et ajouter
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowNewTenant(true)} className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Nouveau locataire
          </Button>
        )}

        {tenantIds.length === 0 && (
          <p className="text-xs text-slate-400">Ajoutez au moins un locataire pour continuer</p>
        )}
      </div>
    )
  }

  // ── LEASE: Le logement ────────────────────────────────────────────────────

  const renderLeLogement = () => (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TF label="Surface habitable (m²)" value={form['Surface habitable'] ?? ''} onChange={f('Surface habitable')} placeholder="ex: 35" />
        <TF label="Nombre de pièces"       value={form['Nombre de pieces'] ?? ''}  onChange={f('Nombre de pieces')}  placeholder="ex: 2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SF label="Type d'habitat" value={form['Type d habitat'] ?? ''}
          options={[{ value: 'Immeuble collectif', label: 'Immeuble collectif' }, { value: 'Individuel', label: 'Individuel' }]}
          onChange={f('Type d habitat')} />
        <SF label="Régime" value={form['Regime'] ?? ''}
          options={[{ value: 'Copropriete', label: 'Copropriété' }, { value: 'Monopropriete', label: 'Monopropriété' }]}
          onChange={f('Regime')} />
      </div>
      <SF label="Période de construction" value={form['Periode de construction'] ?? ''}
        options={[
          { value: 'Avant 1949', label: 'Avant 1949' }, { value: '1949-1974', label: '1949-1974' },
          { value: '1975-1989', label: '1975-1989' },   { value: '1989-2005', label: '1989-2005' },
          { value: 'Depuis 2005', label: 'Depuis 2005' },
        ]}
        onChange={f('Periode de construction')} />
      <TA label="Description du logement" value={form['Description du logement'] ?? ''} onChange={f('Description du logement')} rows={2} placeholder="Description générale..." />
      <TF label="Autres parties"          value={form['Autres parties'] ?? ''}     onChange={f('Autres parties')}     placeholder="ex: Cave, parking..." />
      <TF label="Équipements"             value={form['Equipements'] ?? ''}        onChange={f('Equipements')}        placeholder="ex: Lave-linge, réfrigérateur..." />
    </div>
  )

  // ── LEASE: Durée ──────────────────────────────────────────────────────────

  const renderDuree = () => (
    <div className="grid grid-cols-1 gap-3">
      <TF label="Date d'entrée"        value={form["Date d'entree"] ?? ''}        onChange={f("Date d'entree")}        type="date" />
      <TF label="Durée du bail (mois)" value={form['Duree du bail (mois)'] ?? '12'} onChange={f('Duree du bail (mois)')} type="number" placeholder="12" />
    </div>
  )

  // ── LEASE: Finances (with rent split) ─────────────────────────────────────

  const renderFinances = () => {
    const totalSplit = Object.values(rentSplit).reduce((a, b) => a + b, 0)
    const loyer = parseFloat(form['Loyer mensuel (€)'] ?? '0') || 0
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TF label="Loyer mensuel (€)" value={form['Loyer mensuel (€)'] ?? ''} placeholder="ex: 800"
            onChange={v => { f('Loyer mensuel (€)')(v); if (splitRent) updateRentSplit(tenantIds, parseFloat(v) || 0) }} />
          <TF label="Charges (€)" value={form['Charges (€)'] ?? ''} onChange={f('Charges (€)')} placeholder="ex: 60" />
        </div>
        <TF label="Dépôt de garantie (€)" value={form['Depot de garantie (€)'] ?? ''} onChange={f('Depot de garantie (€)')} placeholder="ex: 800" />
        <SF label="Encadrement des loyers" value={form['Encadrement des loyers'] ?? ''}
          options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]}
          onChange={f('Encadrement des loyers')} />

        {tenantIds.length >= 2 && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Diviser le loyer entre les locataires</span>
              <button
                type="button"
                onClick={() => { const next = !splitRent; setSplitRent(next); if (next) updateRentSplit() }}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                style={{ backgroundColor: splitRent ? '#063B26' : '#e2e8f0' }}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${splitRent ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {splitRent && (
              <div className="space-y-2">
                {tenantIds.map(id => {
                  const t = localTenants.find(lt => lt.id === id)
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 flex-1 truncate">
                        {t ? `${t.first_name} ${t.last_name}` : id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={rentSplit[id] ?? 0}
                          onChange={e => handleSplitChange(id, parseInt(e.target.value) || 0)}
                          className="text-sm w-24 h-8" />
                        <span className="text-sm text-slate-500">€</span>
                      </div>
                    </div>
                  )
                })}
                <div className="flex justify-end text-xs pt-1 border-t border-slate-100">
                  <span className={totalSplit !== loyer ? 'text-red-500' : 'text-emerald-600'}>
                    Total : {totalSplit} € / {loyer} €
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── LEASE: Services ───────────────────────────────────────────────────────

  const renderServices = () => (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-2 gap-3">
        <SF label="Chauffage"  value={form['Chauffage'] ?? ''}
          options={[{ value: 'Individuel', label: 'Individuel' }, { value: 'Collectif', label: 'Collectif' }]}
          onChange={f('Chauffage')} />
        <SF label="Eau chaude" value={form['Eau chaude'] ?? ''}
          options={[{ value: 'Individuelle', label: 'Individuelle' }, { value: 'Collective', label: 'Collective' }]}
          onChange={f('Eau chaude')} />
      </div>
      <TF label="Locaux privatifs" value={form['Locaux privatifs'] ?? ''} onChange={f('Locaux privatifs')} placeholder="ex: Logement complet" />
      <TF label="Parties communes" value={form['Parties communes'] ?? ''} onChange={f('Parties communes')} placeholder="ex: Hall, escaliers" />
      <SF label="Internet" value={form['Internet'] ?? ''}
        options={[{ value: 'Fibre', label: 'Fibre' }, { value: 'ADSL', label: 'ADSL' }, { value: 'Aucun', label: 'Aucun' }]}
        onChange={f('Internet')} />
    </div>
  )

  // ── LEASE: Conditions ─────────────────────────────────────────────────────

  const renderConditions = () => (
    <div className="space-y-3">
      <TA label="Conditions particulières" value={form['Conditions particulieres'] ?? ''} onChange={f('Conditions particulieres')} rows={5} placeholder="Conditions particulières du contrat..." />
      <SF label="Caution solidaire" value={form['Caution solidaire'] ?? ''}
        options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]}
        onChange={f('Caution solidaire')} />
    </div>
  )

  const renderLease = () => {
    if (section === 1) return renderLeBien()
    if (section === 2) return renderLocataires()
    if (section === 3) return renderParties()
    if (section === 4) return renderLeLogement()
    if (section === 5) return renderDuree()
    if (section === 6) return renderFinances()
    if (section === 7) return renderServices()
    if (section === 8) return renderConditions()
    return null
  }

  // ── INSPECTION sections ───────────────────────────────────────────────────

  const renderInspection = () => {
    if (section === 1) return renderParties()

    if (section === 2) return (
      <div className="grid grid-cols-1 gap-3">
        <TF label="Type de logement"   value={form['Type de logement'] ?? ''}   onChange={f('Type de logement')} placeholder="ex: Appartement T2" />
        <TF label="Adresse"            value={form['Adresse'] ?? (doc?.property?.address ?? '')} onChange={f('Adresse')} />
        <div className="grid grid-cols-2 gap-3">
          <TF label="Surface (m²)"     value={form['Surface'] ?? ''}          onChange={f('Surface')} />
          <TF label="Nombre de pièces" value={form['Nombre de pieces'] ?? ''} onChange={f('Nombre de pieces')} />
        </div>
        <TA label="Description des locaux" value={form['Description des locaux'] ?? ''} onChange={f('Description des locaux')} rows={3} />
      </div>
    )

    if (section === 3) return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-xs font-medium text-slate-500">Type</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500">Destination</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500 w-20">Nombre</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {keyEntries.map((entry, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1 pr-2"><Input value={entry.type} onChange={e => { const n=[...keyEntries]; n[i]={...n[i],type:e.target.value}; setKeyEntries(n) }} placeholder="ex: Clé" className="text-sm h-8" /></td>
                  <td className="py-1 pr-2"><Input value={entry.destination} onChange={e => { const n=[...keyEntries]; n[i]={...n[i],destination:e.target.value}; setKeyEntries(n) }} placeholder="ex: Entrée" className="text-sm h-8" /></td>
                  <td className="py-1 pr-2"><Input value={entry.nombre} onChange={e => { const n=[...keyEntries]; n[i]={...n[i],nombre:e.target.value}; setKeyEntries(n) }} type="number" className="text-sm h-8" /></td>
                  <td className="py-1"><button onClick={() => setKeyEntries(keyEntries.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setKeyEntries([...keyEntries, { type: '', destination: '', nombre: '1' }])} className="flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Ajouter une clé
        </Button>
      </div>
    )

    if (section === 4) return (
      <div className="grid grid-cols-1 gap-3">
        {[
          { key: 'Sonnette',          label: 'Sonnette' },
          { key: 'Boite aux lettres', label: 'Boîte aux lettres' },
          { key: 'Detecteur fumee',   label: 'Détecteur de fumée' },
          { key: 'Detecteur CO',      label: 'Détecteur CO' },
        ].map(({ key, label }) => (
          <SF key={key} label={label} value={form[key] ?? ''} options={ETATS_OPTIONS} onChange={f(key)} />
        ))}
      </div>
    )

    if (section === 5) return (
      <div className="grid grid-cols-1 gap-3">
        <TF label="Type de chauffage"    value={form['Type de chauffage'] ?? ''}      onChange={f('Type de chauffage')} placeholder="ex: Électrique" />
        <TF label="Localisation"         value={form['Localisation chauffage'] ?? ''} onChange={f('Localisation chauffage')} placeholder="ex: Salon, chambres" />
        <SF label="État général"         value={form['Etat chauffage'] ?? ''}         options={ETATS_OPTIONS} onChange={f('Etat chauffage')} />
        <TF label="Nombre de radiateurs" value={form['Nombre de radiateurs'] ?? ''}  onChange={f('Nombre de radiateurs')} placeholder="ex: 4" />
      </div>
    )

    if (section === 6) return (
      <div className="space-y-3">
        {[
          { relKey: 'Electricite releve', dateKey: 'Electricite date', relLabel: 'Électricité — Relevé', dateLabel: 'Date relevé élec.' },
          { relKey: 'Gaz releve',         dateKey: 'Gaz date',         relLabel: 'Gaz — Relevé',         dateLabel: 'Date relevé gaz' },
          { relKey: 'Eau releve',         dateKey: 'Eau date',         relLabel: 'Eau — Relevé',         dateLabel: 'Date relevé eau' },
        ].map(({ relKey, dateKey, relLabel, dateLabel }) => (
          <div key={relKey} className="grid grid-cols-2 gap-3">
            <TF label={relLabel}  value={form[relKey] ?? ''}  onChange={f(relKey)} />
            <TF label={dateLabel} value={form[dateKey] ?? ''} onChange={f(dateKey)} type="date" />
          </div>
        ))}
      </div>
    )

    if (section === 7) return (
      <div className="space-y-5">
        {ROOMS.map(room => (
          <div key={room.key}>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 pb-1 border-b border-slate-100">{room.label}</div>
            <div className="space-y-2">
              {ELEMENTS.map(el => (
                <div key={el.key} className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-xs text-slate-500">{el.label}</span>
                  <Select
                    value={piecesState[room.key]?.[el.key]?.etat || undefined}
                    onValueChange={(v: string | null) => setPiecesState(prev => ({
                      ...prev, [room.key]: { ...prev[room.key], [el.key]: { ...prev[room.key]?.[el.key], etat: v ?? 'B' } },
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex-1 text-left text-sm">{piecesState[room.key]?.[el.key]?.etat || <span className="text-muted-foreground">État</span>}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {ETATS_OPTIONS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={piecesState[room.key]?.[el.key]?.desc ?? ''}
                    onChange={e => setPiecesState(prev => ({
                      ...prev, [room.key]: { ...prev[room.key], [el.key]: { ...prev[room.key]?.[el.key], desc: e.target.value } },
                    }))}
                    placeholder="Remarques..." className="text-sm h-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )

    if (section === 8) return (
      <TA label="Observations générales" value={form['Observations'] ?? ''} onChange={f('Observations')} rows={6} placeholder="Observations générales sur l'état du logement..." />
    )

    return null
  }

  // ── INVENTORY sections ────────────────────────────────────────────────────

  const renderInventoryTable = (roomKey: string) => {
    const rows    = inventoryRows[roomKey] ?? []
    const setRows = (next: InventoryRow[]) => setInventoryRows(prev => ({ ...prev, [roomKey]: next }))
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-xs font-medium text-slate-500">Objet</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500 w-14">Qté</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500 w-28">État</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500">Commentaires</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1 pr-2"><Input value={row.objet} onChange={e => { const n=[...rows]; n[i]={...n[i],objet:e.target.value}; setRows(n) }} placeholder="ex: Canapé" className="text-sm h-8" /></td>
                  <td className="py-1 pr-2"><Input value={row.quantite} onChange={e => { const n=[...rows]; n[i]={...n[i],quantite:e.target.value}; setRows(n) }} type="number" className="text-sm h-8" /></td>
                  <td className="py-1 pr-2">
                    <Select value={row.etat || undefined} onValueChange={(v: string | null) => { const n=[...rows]; n[i]={...n[i],etat:v??'Bon'}; setRows(n) }}>
                      <SelectTrigger className="w-full"><span className="flex-1 text-left text-sm">{row.etat || <span className="text-muted-foreground">État</span>}</span></SelectTrigger>
                      <SelectContent>{['Neuf','Bon','Moyen','Très abîmé'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="py-1 pr-2"><Input value={row.commentaires} onChange={e => { const n=[...rows]; n[i]={...n[i],commentaires:e.target.value}; setRows(n) }} placeholder="Commentaires..." className="text-sm h-8" /></td>
                  <td className="py-1"><button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows([...rows, { objet: '', quantite: '1', etat: 'Bon', commentaires: '' }])} className="flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Ajouter un article
        </Button>
      </div>
    )
  }

  const renderInventory = () => {
    if (section === 1) return renderParties()
    if (section >= 2 && section <= 5) return renderInventoryTable(INVENTORY_ROOMS[section - 2].key)
    if (section === 6) return <TA label="Observations" value={form['Observations'] ?? ''} onChange={f('Observations')} rows={5} placeholder="Observations sur l'inventaire..." />
    return null
  }

  const renderGeneric = () => (
    <div className="grid grid-cols-1 gap-3">
      {Object.entries(form).filter(([k]) => !['tenant_ids', 'rent_split'].includes(k)).map(([key, value]) => (
        <TF key={key} label={key} value={value} onChange={f(key)} />
      ))}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  let sectionContent: React.ReactNode
  if (docType === 'lease')                                                    sectionContent = renderLease()
  else if (docType === 'entry_inspection' || docType === 'exit_inspection') sectionContent = renderInspection()
  else if (docType === 'inventory')                                           sectionContent = renderInventory()
  else                                                                         sectionContent = renderGeneric()

  return (
    <div className="space-y-2">
      <Progress />
      <div>
        <h3 className="font-semibold text-slate-700 mb-4">{sections[section - 1]}</h3>
        {sectionContent}
      </div>
      <Nav />
    </div>
  )
}
