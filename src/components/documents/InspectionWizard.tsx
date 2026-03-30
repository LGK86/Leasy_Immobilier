'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Send, CheckCircle2, X, UserPlus } from 'lucide-react'
import SignatureCanvas from './SignatureCanvas'
import type {
  InspectionContent, InventoryContent,
  InspectionCondition, InventoryCondition,
} from '@/types/inspection'
import { createDefaultInspectionContent, createDefaultInventoryContent } from '@/lib/inspection-defaults'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property { id: string; address: string; city: string }
interface Tenant { id: string; first_name: string; last_name: string; property_id: string | null; email?: string | null }

interface Props {
  type: 'entry_inspection' | 'exit_inspection' | 'inventory'
  properties: Property[]
  tenants: Tenant[]
  userId: string
  allDocuments?: any[]
  onSave?: (data: InspectionContent | InventoryContent, status: 'draft' | 'sent') => Promise<void>
  onClose: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_OPTIONS = [
  { value: 'A',  label: 'A — Très bon / Neuf' },
  { value: 'B',  label: 'B — Bon état' },
  { value: 'C',  label: "C — État d'usage" },
  { value: 'D',  label: 'D — Mauvais état' },
  { value: 'HS', label: 'HS — Hors service' },
  { value: 'NV', label: 'NV — Non vérifié' },
]

const INV_CONDITION_OPTIONS = [
  { value: 'Neuf',       label: 'Neuf' },
  { value: 'Bon',        label: 'Bon' },
  { value: 'Moyen',      label: 'Moyen' },
  { value: 'Tres abime', label: 'Très abîmé' },
]

const TYPE_LABELS: Record<string, string> = {
  entry_inspection: "État des lieux d'entrée",
  exit_inspection:  "État des lieux de sortie",
  inventory:        "Inventaire du mobilier",
}

// ─── Section helpers ──────────────────────────────────────────────────────────

function getRoomStart(isInventory: boolean): number { return isInventory ? 1 : 4 }
function getTotalSections(isInventory: boolean, roomCount: number): number {
  // +1 for separate Signatures section at the end
  return isInventory ? 3 + roomCount : 6 + roomCount
}
function getSectionLabel(isInventory: boolean, index: number, rooms: { name: string }[]): string {
  if (isInventory) {
    if (index === 0) return 'Informations'
    if (index <= rooms.length) return rooms[index - 1].name
    if (index === rooms.length + 1) return 'Observations'
    return 'Signatures'
  }
  if (index === 0) return 'Informations'
  if (index === 1) return 'Accès'
  if (index === 2) return 'Accessoires'
  if (index === 3) return 'Chauffage'
  if (index <= 3 + rooms.length) return rooms[index - 4].name
  if (index === 4 + rooms.length) return 'Observations'
  return 'Signatures'
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

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total > 1 ? Math.round((current / (total - 1)) * 100) : 100
  return (
    <div className="mb-2 space-y-1.5">
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="font-medium text-slate-700 truncate max-w-[70%]">{label}</span>
        <span>{current + 1} / {total}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: '#063B26' }}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InspectionWizard({ type, properties, tenants, userId, allDocuments = [], onSave, onClose }: Props) {
  const supabase = createClient()
  const isInventory = type === 'inventory'

  const [savedDocId,          setSavedDocId]          = useState<string | null>(null)
  const [saving,              setSaving]              = useState(false)
  const [generating,          setGenerating]          = useState(false)
  const [sigSending,          setSigSending]          = useState(false)
  const [sigSubStep,          setSigSubStep]          = useState<'sign' | 'send'>('sign')
  const [propertyId,          setPropertyId]          = useState('')
  const [tenantIds,           setTenantIds]           = useState<string[]>([])
  const [surface,             setSurface]             = useState('')
  const [roomsCount,          setRoomsCount]          = useState('')
  const [sectionIndex,        setSectionIndex]        = useState(0)
  const [ownerSig,            setOwnerSig]            = useState<string | null>(null)
  const [linkEntryInspection, setLinkEntryInspection] = useState(false)
  const [linkedEntryId,       setLinkedEntryId]       = useState('')
  const [localTenants,        setLocalTenants]        = useState<Tenant[]>(tenants)
  const [showNewTenant,       setShowNewTenant]       = useState(false)
  const [newTenantForm,       setNewTenantForm]       = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [creatingTenant,      setCreatingTenant]      = useState(false)

  const [content, setContent] = useState<InspectionContent | InventoryContent>(() =>
    isInventory
      ? createDefaultInventoryContent()
      : createDefaultInspectionContent(type === 'entry_inspection' ? 'entry' : 'exit')
  )

  // Typed aliases — used only in the relevant sections
  const ic = content as InspectionContent
  const vc = content as InventoryContent

  const rooms       = content.rooms
  const roomStart   = getRoomStart(isInventory)
  const totalSec    = getTotalSections(isInventory, rooms.length)
  const isLastSec   = sectionIndex === totalSec - 1
  const isSigSec    = sectionIndex === totalSec - 1
  const isObsSec    = sectionIndex === totalSec - 2
  const isRoomSec   = sectionIndex >= roomStart && sectionIndex < roomStart + rooms.length
  const roomIdx     = isRoomSec ? sectionIndex - roomStart : -1
  const sectionLabel = getSectionLabel(isInventory, sectionIndex, rooms)

  const entryInspections = allDocuments.filter(
    d => d.type === 'entry_inspection' && d.property_id === propertyId
  )
  const availableEntryInspections = allDocuments.filter(
    d => d.type === 'entry_inspection' && d.property_id === propertyId && d.status !== 'draft'
  )

  // ── Property selection with auto-fill ────────────────────────
  const handlePropertySelect = async (pid: string) => {
    setPropertyId(pid)
    setTenantIds([])
    if (pid) {
      const { data: prop } = await supabase
        .from('properties')
        .select('surface, rooms_count')
        .eq('id', pid)
        .single()
      if (prop) {
        setSurface(prop.surface != null ? String(prop.surface) : '')
        setRoomsCount(prop.rooms_count != null ? String(prop.rooms_count) : '')
      }
    }
  }

  // ── Tenant multi-select helpers ───────────────────────────────
  const addTenant = (id: string) => {
    if (!id || tenantIds.includes(id)) return
    setTenantIds(prev => [...prev, id])
  }
  const removeTenant = (id: string) => setTenantIds(prev => prev.filter(t => t !== id))

  // ── Generic content updater ───────────────────────────────────
  const setField = (key: string, value: unknown) => {
    setContent(prev => ({ ...prev, [key]: value }) as InspectionContent | InventoryContent)
  }

  const updateRoom = (index: number, updater: (room: any) => any) => {
    setContent(prev => {
      const newRooms = [...prev.rooms]
      newRooms[index] = updater(newRooms[index])
      return { ...prev, rooms: newRooms } as InspectionContent | InventoryContent
    })
  }

  const addRoom = () => {
    const newRoom = isInventory
      ? { id: `room_${Date.now()}`, name: 'Nouvelle pièce', order: rooms.length + 1, items: [] }
      : { id: `room_${Date.now()}`, name: 'Nouvelle pièce', order: rooms.length + 1, elements: [], remarks: '' }
    const newRooms = [...rooms, newRoom]
    setContent(prev => ({ ...prev, rooms: newRooms }) as InspectionContent | InventoryContent)
    setSectionIndex(roomStart + newRooms.length - 1)
  }

  const removeRoom = (index: number) => {
    setContent(prev => ({
      ...prev,
      rooms: prev.rooms.filter((_, i) => i !== index),
    }) as InspectionContent | InventoryContent)
    setSectionIndex(roomStart + Math.max(0, index - 1))
  }

  // ── Save helpers ──────────────────────────────────────────────
  const buildPayload = (status: 'draft' | 'sent') => {
    const prop = properties.find(p => p.id === propertyId)
    const title = prop ? `${TYPE_LABELS[type]} — ${prop.address}` : TYPE_LABELS[type]
    const contentWithMeta = {
      ...content,
      surface:     parseFloat(surface) || null,
      rooms_count: parseInt(roomsCount) || null,
      tenant_ids:  tenantIds,
    }
    return {
      owner_id:        userId,
      property_id:     propertyId || null,
      tenant_id:       tenantIds[0] || null,
      type,
      title,
      content:         contentWithMeta,
      owner_signature:  ownerSig,
      status,
      updated_at: new Date().toISOString(),
    }
  }

  const persistDraft = async (): Promise<string | null> => {
    const payload = buildPayload('draft')
    if (savedDocId) {
      const { error } = await supabase.from('documents').update(payload).eq('id', savedDocId)
      if (error) { toast.error('Erreur : ' + error.message); return null }
      return savedDocId
    }
    const { data, error } = await supabase.from('documents').insert(payload).select('id').single()
    if (error) { toast.error('Erreur : ' + error.message); return null }
    if (data?.id) { setSavedDocId(data.id); return data.id }
    return null
  }

  const handleSaveDraft = async () => {
    if (!propertyId) { toast.error('Veuillez sélectionner un bien'); return }
    setSaving(true)
    const id = await persistDraft()
    if (id) {
      await onSave?.(content, 'draft')
      toast.success('Brouillon enregistré')
    }
    setSaving(false)
  }

  const handleGenerate = async () => {
    if (!propertyId) { toast.error('Veuillez sélectionner un bien'); return }
    setGenerating(true)
    const id = await persistDraft()
    if (!id) { setGenerating(false); return }
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
      })
      const data = await res.json()
      if (data.success) {
        await onSave?.(content, 'sent')
        toast.success('Document généré')
        onClose()
      } else {
        toast.error('Erreur génération : ' + (data.error ?? 'inconnue'))
      }
    } catch {
      toast.error('Erreur lors de la génération')
    }
    setGenerating(false)
  }

  const handleSendSigningLink = async () => {
    if (!propertyId) { toast.error('Veuillez sélectionner un bien'); return }
    if (tenantIds.length === 0) { toast.error('Veuillez sélectionner au moins un locataire'); return }
    setSigSending(true)
    const id = await persistDraft()
    if (!id) { setSigSending(false); return }
    await supabase.from('documents').update({
      owner_signature: ownerSig,
      status: 'signed',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    try {
      const res = await fetch('/api/documents/send-signing-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
      })
      if (res.ok) {
        toast.success('Lien de signature envoyé au locataire')
        onClose()
      } else {
        toast.error("Erreur lors de l'envoi")
      }
    } catch {
      toast.error("Erreur lors de l'envoi")
    }
    setSigSending(false)
  }

  // ── Inline tenant creation ────────────────────────────────────
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
      .select('id, first_name, last_name, property_id, email')
      .single()
    if (!error && data) {
      const entry: Tenant = { ...data, property_id: data.property_id ?? null }
      setLocalTenants(prev => [...prev, entry])
      addTenant(data.id)
      setNewTenantForm({ first_name: '', last_name: '', email: '', phone: '' })
      setShowNewTenant(false)
      toast.success('Locataire créé et ajouté')
    } else if (error) {
      toast.error('Erreur : ' + error.message)
    }
    setCreatingTenant(false)
  }

  // ─── Section 0 — Informations générales ───────────────────────────────────

  const renderInfoSection = () => {
    const filteredTenants = localTenants.filter(t => !propertyId || t.property_id === propertyId || t.property_id === null)
    const unselectedTenants = filteredTenants.filter(t => !tenantIds.includes(t.id))
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
          {TYPE_LABELS[type]}
        </p>

        <LF label="Bien *">
          <Select
            value={propertyId || undefined}
            onValueChange={(v: string | null) => handlePropertySelect(v ?? '')}
          >
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left truncate text-sm">
                {propertyId
                  ? (() => { const p = properties.find(p => p.id === propertyId); return p ? `${p.address}, ${p.city}` : '' })()
                  : <span className="text-muted-foreground">Sélectionner un bien</span>}
              </span>
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>)}
            </SelectContent>
          </Select>
        </LF>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500">Locataire(s) *</label>

          {tenantIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tenantIds.map(id => {
                const t = localTenants.find(t => t.id === id)
                if (!t) return null
                return (
                  <div key={id} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-full">
                    <span>{t.first_name} {t.last_name}</span>
                    <button type="button" onClick={() => removeTenant(id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {unselectedTenants.length > 0 && (
            <LF label="Ajouter un locataire existant">
              <Select onValueChange={(v: string | null) => { if (v) addTenant(v) }}>
                <SelectTrigger className="w-full">
                  <span className="flex-1 text-left text-sm text-muted-foreground">Sélectionner un locataire</span>
                </SelectTrigger>
                <SelectContent>
                  {unselectedTenants.map(t => (
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
                <LF label="Prénom *">
                  <Input className="text-sm" placeholder="Jean"
                    value={newTenantForm.first_name}
                    onChange={e => setNewTenantForm(f => ({ ...f, first_name: e.target.value }))} />
                </LF>
                <LF label="Nom *">
                  <Input className="text-sm" placeholder="Dupont"
                    value={newTenantForm.last_name}
                    onChange={e => setNewTenantForm(f => ({ ...f, last_name: e.target.value }))} />
                </LF>
              </div>
              <LF label="Email *">
                <Input type="email" className="text-sm" placeholder="jean@exemple.com"
                  value={newTenantForm.email}
                  onChange={e => setNewTenantForm(f => ({ ...f, email: e.target.value }))} />
              </LF>
              <LF label="Téléphone">
                <Input className="text-sm" placeholder="Optionnel"
                  value={newTenantForm.phone}
                  onChange={e => setNewTenantForm(f => ({ ...f, phone: e.target.value }))} />
              </LF>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewTenant(false)}>
                  Annuler
                </Button>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LF label={isInventory ? "Date de l'inventaire *" : "Date de l'état des lieux *"}>
            <Input
              type="date"
              value={isInventory ? vc.inventory_date : ic.inspection_date}
              onChange={e => setField(isInventory ? 'inventory_date' : 'inspection_date', e.target.value)}
              className="text-sm"
            />
          </LF>
          <LF label="Nombre d'exemplaires">
            <Input
              type="number"
              value={String(content.copies_count)}
              onChange={e => setField('copies_count', parseInt(e.target.value) || 2)}
              className="text-sm"
            />
          </LF>
        </div>

        {!isInventory && (
          <LF label="Description du logement">
            <Textarea
              value={ic.description}
              onChange={e => setField('description', e.target.value)}
              rows={3}
              placeholder="Appartement de 2 pièces, 45 m²…"
              className="text-sm resize-none"
            />
          </LF>
        )}

        {isInventory && entryInspections.length > 0 && (
          <LF label="État des lieux d'entrée associé (optionnel)">
            <Select
              value={vc.linked_inspection_id ?? 'none'}
              onValueChange={(v: string | null) => setField('linked_inspection_id', (!v || v === 'none') ? null : v)}
            >
              <SelectTrigger className="w-full">
                <span className="flex-1 text-left truncate text-sm">
                  {vc.linked_inspection_id
                    ? entryInspections.find(d => d.id === vc.linked_inspection_id)?.title ?? 'Sélectionné'
                    : <span className="text-muted-foreground">Aucun</span>}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {entryInspections.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </LF>
        )}

        {type === 'exit_inspection' && (
          <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="link_entry_inspection"
                checked={linkEntryInspection}
                onChange={e => {
                  setLinkEntryInspection(e.target.checked)
                  if (!e.target.checked) {
                    setLinkedEntryId('')
                    setField('linked_inspection_id', null)
                  }
                }}
                className="h-4 w-4 accent-[#063B26]"
              />
              <label htmlFor="link_entry_inspection" className="text-sm text-slate-700 cursor-pointer">
                Clôturer un état des lieux d&apos;entrée existant ?
              </label>
            </div>
            {linkEntryInspection && (
              <LF label="Sélectionner l'état des lieux d'entrée">
                <Select
                  value={linkedEntryId || undefined}
                  onValueChange={(v: string | null) => {
                    const id = v ?? ''
                    setLinkedEntryId(id)
                    setField('linked_inspection_id', id || null)
                    if (id) {
                      const entryDoc = allDocuments.find(d => d.id === id)
                      if (entryDoc?.content) {
                        const ec = entryDoc.content as InspectionContent
                        setContent(prev => ({
                          ...prev,
                          rooms:       JSON.parse(JSON.stringify(ec.rooms       ?? [])),
                          accessories: JSON.parse(JSON.stringify(ec.accessories ?? [])),
                          heating:     { ...ec.heating },
                          meters:      JSON.parse(JSON.stringify(ec.meters      ?? [])),
                          access_keys: JSON.parse(JSON.stringify(ec.access_keys ?? [])),
                        } as InspectionContent))
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className="flex-1 text-left truncate text-sm">
                      {linkedEntryId
                        ? availableEntryInspections.find(d => d.id === linkedEntryId)?.title ?? 'Sélectionné'
                        : <span className="text-muted-foreground">Choisir un état des lieux d&apos;entrée</span>}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableEntryInspections.length === 0
                      ? <SelectItem value="_none" disabled>Aucun état des lieux finalisé pour ce bien</SelectItem>
                      : availableEntryInspections.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </LF>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <LF label="Surface (m²)">
            <Input
              type="number"
              value={surface}
              onChange={e => setSurface(e.target.value)}
              placeholder="45"
              className="text-sm"
            />
          </LF>
          <LF label="Nombre de pièces">
            <Input
              type="number"
              value={roomsCount}
              onChange={e => setRoomsCount(e.target.value)}
              placeholder="3"
              className="text-sm"
            />
          </LF>
        </div>
      </div>
    )
  }

  // ─── Section 1 (inspection) — Moyens d'accès ──────────────────────────────

  const renderAccessSection = () => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Moyens d&apos;accès et clés</p>
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
          <span className="col-span-4">Type</span>
          <span className="col-span-5">Destination</span>
          <span className="col-span-2 text-center">Qté</span>
          <span className="col-span-1" />
        </div>
        {ic.access_keys.map((key, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-4 text-sm" placeholder="Badge"
              value={key.key_type}
              onChange={e => { const ks = [...ic.access_keys]; ks[i] = { ...ks[i], key_type: e.target.value }; setField('access_keys', ks) }}
            />
            <Input className="col-span-5 text-sm" placeholder="Entrée immeuble"
              value={key.destination}
              onChange={e => { const ks = [...ic.access_keys]; ks[i] = { ...ks[i], destination: e.target.value }; setField('access_keys', ks) }}
            />
            <Input className="col-span-2 text-sm" type="number" min={1}
              value={key.quantity}
              onChange={e => { const ks = [...ic.access_keys]; ks[i] = { ...ks[i], quantity: parseInt(e.target.value) || 1 }; setField('access_keys', ks) }}
            />
            <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-red-400"
              onClick={() => setField('access_keys', ic.access_keys.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm"
        onClick={() => setField('access_keys', [...ic.access_keys, { key_type: '', destination: '', quantity: 1 }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un moyen d&apos;accès
      </Button>
    </div>
  )

  // ─── Section 2 (inspection) — Accessoires ─────────────────────────────────

  const renderAccessoriesSection = () => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Accessoires et équipements</p>
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
          <span className="col-span-7">Accessoire</span>
          <span className="col-span-4">État</span>
          <span className="col-span-1" />
        </div>
        {ic.accessories.map((acc, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-7 text-sm" placeholder="Sonnette"
              value={acc.name}
              onChange={e => { const a = [...ic.accessories]; a[i] = { ...a[i], name: e.target.value }; setField('accessories', a) }}
            />
            <div className="col-span-4">
              <Select value={acc.condition}
                onValueChange={(v: string | null) => {
                  const a = [...ic.accessories]; a[i] = { ...a[i], condition: (v ?? 'A') as InspectionCondition }; setField('accessories', a)
                }}>
                <SelectTrigger className="w-full"><span className="text-sm">{acc.condition}</span></SelectTrigger>
                <SelectContent>{CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-red-400"
              onClick={() => setField('accessories', ic.accessories.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm"
        onClick={() => setField('accessories', [...ic.accessories, { name: '', condition: 'A' as InspectionCondition }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un accessoire
      </Button>
    </div>
  )

  // ─── Section 3 (inspection) — Chauffage et compteurs ──────────────────────

  const renderHeatingMetersSection = () => (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Chauffage</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Type de chauffage</label>
            <Input
              value={ic.heating.type}
              placeholder="Chaudière individuelle gaz"
              onChange={e => setField('heating', { ...ic.heating, type: e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Localisation</label>
            <Input
              value={ic.heating.location}
              placeholder="Cuisine"
              onChange={e => setField('heating', { ...ic.heating, location: e.target.value })}
              className="text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">État général</label>
            <Input
              value={ic.heating.general_condition}
              placeholder="Neuf"
              onChange={e => setField('heating', { ...ic.heating, general_condition: e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Nombre de radiateurs</label>
            <Input
              type="number"
              value={String(ic.heating.radiator_count)}
              onChange={e => setField('heating', { ...ic.heating, radiator_count: parseInt(e.target.value) || 0 })}
              className="text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">État des radiateurs</label>
          <Input
            value={ic.heating.radiator_condition}
            placeholder="Bon état"
            onChange={e => setField('heating', { ...ic.heating, radiator_condition: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Compteurs</p>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1.5 text-xs font-medium text-slate-500 px-1">
            <span className="col-span-2">Énergie</span>
            <span className="col-span-2">Fournisseur</span>
            <span className="col-span-3">Localisation</span>
            <span className="col-span-2">Relevé</span>
            <span className="col-span-2">Date</span>
            <span className="col-span-1" />
          </div>
          {ic.meters.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
              <Input className="col-span-2 text-xs" value={m.energy_type}
                onChange={e => { const ms = [...ic.meters]; ms[i] = { ...ms[i], energy_type: e.target.value }; setField('meters', ms) }} />
              <Input className="col-span-2 text-xs" value={m.provider}
                onChange={e => { const ms = [...ic.meters]; ms[i] = { ...ms[i], provider: e.target.value }; setField('meters', ms) }} />
              <Input className="col-span-3 text-xs" value={m.location}
                onChange={e => { const ms = [...ic.meters]; ms[i] = { ...ms[i], location: e.target.value }; setField('meters', ms) }} />
              <Input className="col-span-2 text-xs" value={m.reading}
                onChange={e => { const ms = [...ic.meters]; ms[i] = { ...ms[i], reading: e.target.value }; setField('meters', ms) }} />
              <Input className="col-span-2 text-xs" type="date" value={m.reading_date}
                onChange={e => { const ms = [...ic.meters]; ms[i] = { ...ms[i], reading_date: e.target.value }; setField('meters', ms) }} />
              <Button type="button" variant="ghost" size="icon" className="col-span-1 h-7 w-7 text-red-400"
                onClick={() => setField('meters', ic.meters.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm"
          onClick={() => setField('meters', [...ic.meters, { energy_type: '', provider: '', location: '', reading: '', reading_date: '' }])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un compteur
        </Button>
      </div>
    </div>
  )

  // ─── Inspection room section ───────────────────────────────────────────────

  const renderInspectionRoomSection = (idx: number) => {
    const room = ic.rooms[idx]
    if (!room) return null
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Input className="text-sm font-medium flex-1" value={room.name}
            onChange={e => updateRoom(idx, r => ({ ...r, name: e.target.value }))} />
          {ic.rooms.length > 1 && (
            <Button type="button" variant="outline" size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50 shrink-0"
              onClick={() => removeRoom(idx)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid gap-2 text-xs font-medium text-slate-500 px-1" style={{ gridTemplateColumns: '15% 10% 37.5% 37.5% auto' }}>
            <span>Élément</span>
            <span>État</span>
            <span>Description</span>
            <span>Commentaire</span>
            <span />
          </div>
          {room.elements.map((el: any, j: number) => (
            <div key={j} className="grid gap-2 items-center" style={{ gridTemplateColumns: '15% 10% 37.5% 37.5% auto' }}>
              <Input className="text-xs" value={el.name}
                onChange={e => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], name: e.target.value }; return { ...r, elements: els } })} />
              <Select value={el.condition}
                onValueChange={(v: string | null) => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], condition: (v ?? 'A') as InspectionCondition }; return { ...r, elements: els } })}>
                <SelectTrigger className="w-full h-8"><span className="text-xs">{el.condition}</span></SelectTrigger>
                <SelectContent>{CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="text-xs" placeholder="…"
                value={el.description}
                onChange={e => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], description: e.target.value }; return { ...r, elements: els } })} />
              <Input className="text-xs" placeholder="…"
                value={el.comment}
                onChange={e => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], comment: e.target.value }; return { ...r, elements: els } })} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400"
                onClick={() => updateRoom(idx, r => ({ ...r, elements: r.elements.filter((_: any, k: number) => k !== j) }))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm"
          onClick={() => updateRoom(idx, r => ({ ...r, elements: [...r.elements, { name: '', description: '', condition: 'A' as InspectionCondition, comment: '' }] }))}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un élément
        </Button>

        <LF label="Observations de la pièce">
          <Textarea value={room.remarks} rows={2} className="text-sm resize-none"
            onChange={e => updateRoom(idx, r => ({ ...r, remarks: e.target.value }))} />
        </LF>

        {idx === ic.rooms.length - 1 && (
          <>
            <Separator />
            <Button type="button" variant="outline" size="sm" onClick={addRoom}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une pièce
            </Button>
          </>
        )}
      </div>
    )
  }

  // ─── Inventory room section ────────────────────────────────────────────────

  const renderInventoryRoomSection = (idx: number) => {
    const room = vc.rooms[idx]
    if (!room) return null
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Input className="text-sm font-medium flex-1" value={room.name}
            onChange={e => updateRoom(idx, r => ({ ...r, name: e.target.value }))} />
          {vc.rooms.length > 1 && (
            <Button type="button" variant="outline" size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50 shrink-0"
              onClick={() => removeRoom(idx)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
            <span className="col-span-4">Objet</span>
            <span className="col-span-1">Qté</span>
            <span className="col-span-3">État</span>
            <span className="col-span-3">Commentaire</span>
            <span className="col-span-1" />
          </div>
          {room.items.map((item: any, j: number) => (
            <div key={j} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-4 text-xs" placeholder="Table basse" value={item.name}
                onChange={e => updateRoom(idx, r => { const items = [...r.items]; items[j] = { ...items[j], name: e.target.value }; return { ...r, items } })} />
              <Input className="col-span-1 text-xs" type="number" min={1} value={item.quantity}
                onChange={e => updateRoom(idx, r => { const items = [...r.items]; items[j] = { ...items[j], quantity: parseInt(e.target.value) || 1 }; return { ...r, items } })} />
              <div className="col-span-3">
                <Select value={item.condition}
                  onValueChange={(v: string | null) => updateRoom(idx, r => { const items = [...r.items]; items[j] = { ...items[j], condition: (v ?? 'Bon') as InventoryCondition }; return { ...r, items } })}>
                  <SelectTrigger className="w-full h-8"><span className="text-xs">{item.condition}</span></SelectTrigger>
                  <SelectContent>{INV_CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input className="col-span-3 text-xs" placeholder="…" value={item.comment}
                onChange={e => updateRoom(idx, r => { const items = [...r.items]; items[j] = { ...items[j], comment: e.target.value }; return { ...r, items } })} />
              <Button type="button" variant="ghost" size="icon" className="col-span-1 h-7 w-7 text-red-400"
                onClick={() => updateRoom(idx, r => ({ ...r, items: r.items.filter((_: any, k: number) => k !== j) }))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm"
          onClick={() => updateRoom(idx, r => ({ ...r, items: [...r.items, { name: '', quantity: 1, condition: 'Bon' as InventoryCondition, comment: '' }] }))}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un objet
        </Button>

        {idx === vc.rooms.length - 1 && (
          <>
            <Separator />
            <Button type="button" variant="outline" size="sm" onClick={addRoom}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une pièce
            </Button>
          </>
        )}
      </div>
    )
  }

  // ─── Observations section (penultimate) ───────────────────────────────────

  const renderObservationsSection = () => (
    <div className="space-y-5">
      <LF label="Observations générales">
        <Textarea
          value={content.general_observations}
          rows={5}
          className="text-sm resize-none"
          placeholder="Remarques générales sur l'état du logement…"
          onChange={e => setField('general_observations', e.target.value)}
        />
      </LF>

      {!isInventory && (
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
          Le présent état des lieux établi contradictoirement entre les parties qui le reconnaissent,
          fait partie intégrante du contrat de location dont il ne peut être dissocié.
        </div>
      )}
    </div>
  )

  // ─── Signatures section (last) — identical to bail flow ───────────────────

  const renderSignaturesSection = () => (
    <div className="space-y-4 max-w-[500px] mx-auto">
      {/* Mini step indicator */}
      <div className="flex items-center gap-1 mb-2">
        {(['sign', 'send'] as const).map((step, i) => {
          const labels = { sign: 'Signature', send: 'Envoi' }
          const done   = sigSubStep === 'send' && step === 'sign'
          const active = sigSubStep === step
          return (
            <div key={step} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                done   ? 'bg-emerald-100 text-emerald-700' :
                active ? 'text-white' : 'bg-slate-100 text-slate-400'
              }`} style={active ? { backgroundColor: '#063B26' } : {}}>
                {done
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <span className="h-4 w-4 flex items-center justify-center rounded-full border text-[10px] border-current">{i + 1}</span>
                }
                {labels[step]}
              </div>
              {i === 0 && (
                <div className={`h-px w-4 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step: Signature bailleur ── */}
      {sigSubStep === 'sign' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Signature du bailleur</h3>
            {ownerSig && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </div>

          {ownerSig ? (
            <>
              <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
                <img src={ownerSig} alt="Signature bailleur" className="h-16 object-contain" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOwnerSig(null)}>
                  Modifier la signature
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSigSubStep('send')}
                  className="text-[#063B26] font-semibold"
                  style={{ backgroundColor: '#CFFF92' }}
                >
                  Continuer →
                </Button>
              </div>
            </>
          ) : (
            <div className="border border-slate-200 rounded-lg p-3 max-w-[400px] mx-auto">
              <p className="text-xs text-slate-500 mb-2">Signez dans le cadre ci-dessous</p>
              <SignatureCanvas
                onSave={(sig) => { setOwnerSig(sig); setSigSubStep('send') }}
                existingSignature={ownerSig}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Step: Envoi au(x) locataire(s) ── */}
      {sigSubStep === 'send' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Envoi au locataire</h3>

          {ownerSig && (
            <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50 mb-2">
              <p className="text-xs text-slate-500 mb-1">Signature enregistrée</p>
              <img src={ownerSig} alt="Signature bailleur" className="h-12 object-contain" />
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            Votre document est signé. Envoyez le lien de signature au locataire, ou générez le PDF directement.
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSendSigningLink}
              disabled={tenantIds.length === 0 || sigSending || saving}
              className="w-full text-[#063B26] font-semibold"
              style={{ backgroundColor: '#CFFF92' }}
            >
              {sigSending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Send className="h-4 w-4 mr-2" />}
              Envoyer le lien de signature
            </Button>
            {tenantIds.length === 0 && (
              <p className="text-xs text-amber-600">Sélectionnez un locataire à l&apos;étape 1 pour activer cette option.</p>
            )}
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={!propertyId || generating || saving}
              className="w-full"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Générer le PDF sans signature locataire
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setSigSubStep('sign')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Retour à la signature
          </button>
        </div>
      )}
    </div>
  )

  // ─── Section dispatcher ────────────────────────────────────────────────────

  const renderSection = () => {
    if (sectionIndex === 0) return renderInfoSection()
    if (isInventory) {
      if (isRoomSec)  return renderInventoryRoomSection(roomIdx)
      if (isObsSec)   return renderObservationsSection()
      return renderSignaturesSection()
    }
    if (sectionIndex === 1) return renderAccessSection()
    if (sectionIndex === 2) return renderAccessoriesSection()
    if (sectionIndex === 3) return renderHeatingMetersSection()
    if (isRoomSec)  return renderInspectionRoomSection(roomIdx)
    if (isObsSec)   return renderObservationsSection()
    return renderSignaturesSection()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <ProgressBar current={sectionIndex} total={totalSec} label={sectionLabel} />

      <div className="min-h-[300px]">
        {renderSection()}
      </div>

      <div className="flex justify-center items-center gap-3 pt-4 border-t flex-wrap">
        <Button type="button" variant="outline" size="sm"
          onClick={() => {
            if (isSigSec && sigSubStep === 'send') {
              setSigSubStep('sign')
            } else {
              setSectionIndex(i => Math.max(0, i - 1))
            }
          }}
          disabled={sectionIndex === 0 && sigSubStep === 'sign'}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>

        {!isLastSec && (
          <Button type="button" size="sm"
            onClick={() => setSectionIndex(i => Math.min(totalSec - 1, i + 1))}
            className="text-[#063B26] font-semibold"
            style={{ backgroundColor: '#CFFF92' }}>
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}

        <Button type="button" variant="ghost" size="sm"
          onClick={handleSaveDraft} disabled={saving || generating}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Brouillon
        </Button>
      </div>
    </div>
  )
}
