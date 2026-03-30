'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
  { value: 'A',  label: 'A — Tres bon / Neuf' },
  { value: 'B',  label: 'B — Bon etat' },
  { value: 'C',  label: "C — Etat d usage" },
  { value: 'D',  label: 'D — Mauvais etat' },
  { value: 'HS', label: 'HS — Hors service' },
  { value: 'NV', label: 'NV — Non verifie' },
]

const INV_CONDITION_OPTIONS = [
  { value: 'Neuf',       label: 'Neuf' },
  { value: 'Bon',        label: 'Bon' },
  { value: 'Moyen',      label: 'Moyen' },
  { value: 'Tres abime', label: 'Tres abime' },
]

const TYPE_LABELS: Record<string, string> = {
  entry_inspection: "Etat des lieux d entree",
  exit_inspection:  "Etat des lieux de sortie",
  inventory:        "Inventaire",
}

// ─── Section helpers ──────────────────────────────────────────────────────────

function getRoomStart(isInventory: boolean): number { return isInventory ? 1 : 4 }
function getTotalSections(isInventory: boolean, roomCount: number): number {
  return isInventory ? 2 + roomCount : 5 + roomCount
}
function getSectionLabel(isInventory: boolean, index: number, rooms: { name: string }[]): string {
  if (isInventory) {
    if (index === 0) return 'Informations'
    if (index <= rooms.length) return rooms[index - 1].name
    return 'Observations'
  }
  if (index === 0) return 'Informations'
  if (index === 1) return 'Acces'
  if (index === 2) return 'Accessoires'
  if (index === 3) return 'Chauffage'
  if (index <= 3 + rooms.length) return rooms[index - 4].name
  return 'Observations'
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

  const [savedDocId,   setSavedDocId]   = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [propertyId,   setPropertyId]   = useState('')
  const [tenantId,     setTenantId]     = useState('')
  const [surface,      setSurface]      = useState('')
  const [roomsCount,   setRoomsCount]   = useState('')
  const [sectionIndex, setSectionIndex] = useState(0)
  const [ownerSig,     setOwnerSig]     = useState<string | null>(null)
  const [tenantSig,    setTenantSig]    = useState<string | null>(null)

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
  const isRoomSec   = sectionIndex >= roomStart && sectionIndex < roomStart + rooms.length
  const roomIdx     = isRoomSec ? sectionIndex - roomStart : -1
  const sectionLabel = getSectionLabel(isInventory, sectionIndex, rooms)

  const entryInspections = allDocuments.filter(
    d => d.type === 'entry_inspection' && d.property_id === propertyId
  )

  // ── Property selection with auto-fill ────────────────────────
  const handlePropertySelect = async (pid: string) => {
    setPropertyId(pid)
    setTenantId('')
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
      ? { id: `room_${Date.now()}`, name: 'Nouvelle piece', order: rooms.length + 1, items: [] }
      : { id: `room_${Date.now()}`, name: 'Nouvelle piece', order: rooms.length + 1, elements: [], remarks: '' }
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
    }
    return {
      owner_id:        userId,
      property_id:     propertyId || null,
      tenant_id:       tenantId   || null,
      type,
      title,
      content:         contentWithMeta,
      owner_signature:  ownerSig,
      tenant_signature: tenantSig,
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
    if (!propertyId) { toast.error('Veuillez selectionner un bien'); return }
    setSaving(true)
    const id = await persistDraft()
    if (id) {
      await onSave?.(content, 'draft')
      toast.success('Brouillon enregistre')
    }
    setSaving(false)
  }

  const handleGenerate = async () => {
    if (!propertyId) { toast.error('Veuillez selectionner un bien'); return }
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
        toast.success('Document genere')
        onClose()
      } else {
        toast.error('Erreur generation : ' + (data.error ?? 'inconnue'))
      }
    } catch {
      toast.error('Erreur lors de la generation')
    }
    setGenerating(false)
  }

  // ─── Section 0 — Informations générales ───────────────────────────────────

  const renderInfoSection = () => {
    const filteredTenants = tenants.filter(t => !propertyId || t.property_id === propertyId || t.property_id === null)
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
                  : <span className="text-muted-foreground">Selectionner un bien</span>}
              </span>
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>)}
            </SelectContent>
          </Select>
        </LF>

        <LF label="Locataire *">
          <Select
            value={tenantId || undefined}
            onValueChange={(v: string | null) => setTenantId(v ?? '')}
          >
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left truncate text-sm">
                {tenantId
                  ? (() => { const t = filteredTenants.find(t => t.id === tenantId); return t ? `${t.first_name} ${t.last_name}` : '' })()
                  : <span className="text-muted-foreground">Selectionner un locataire</span>}
              </span>
            </SelectTrigger>
            <SelectContent>
              {filteredTenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LF>

        <div className="grid grid-cols-2 gap-3">
          <TF
            label={isInventory ? "Date de l inventaire *" : "Date de l etat des lieux *"}
            value={isInventory ? vc.inventory_date : ic.inspection_date}
            onChange={v => setField(isInventory ? 'inventory_date' : 'inspection_date', v)}
            type="date"
          />
          <TF
            label="Nombre d exemplaires"
            value={String(content.copies_count)}
            onChange={v => setField('copies_count', parseInt(v) || 2)}
            type="number"
          />
        </div>

        {!isInventory && (
          <LF label="Description du logement">
            <Textarea
              value={ic.description}
              onChange={e => setField('description', e.target.value)}
              rows={3}
              placeholder="Appartement de 2 pieces, 45m2..."
              className="text-sm resize-none"
            />
          </LF>
        )}

        {isInventory && entryInspections.length > 0 && (
          <LF label="Etat des lieux d entree associe (optionnel)">
            <Select
              value={vc.linked_inspection_id ?? 'none'}
              onValueChange={(v: string | null) => setField('linked_inspection_id', (!v || v === 'none') ? null : v)}
            >
              <SelectTrigger className="w-full">
                <span className="flex-1 text-left truncate text-sm">
                  {vc.linked_inspection_id
                    ? entryInspections.find(d => d.id === vc.linked_inspection_id)?.title ?? 'Selectionne'
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

        <div className="grid grid-cols-2 gap-3">
          <TF
            label="Surface (m2)"
            value={surface}
            onChange={setSurface}
            type="number"
            placeholder="45"
          />
          <TF
            label="Nombre de pieces"
            value={roomsCount}
            onChange={setRoomsCount}
            type="number"
            placeholder="3"
          />
        </div>

        <TF
          label="Lieu de signature"
          value={content.location}
          onChange={v => setField('location', v)}
          placeholder="Paris"
        />
      </div>
    )
  }

  // ─── Section 1 (inspection) — Moyens d'accès ──────────────────────────────

  const renderAccessSection = () => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Moyens d acces et cles</p>
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
          <span className="col-span-4">Type</span>
          <span className="col-span-5">Destination</span>
          <span className="col-span-2 text-center">Qte</span>
          <span className="col-span-1" />
        </div>
        {ic.access_keys.map((key, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-4 text-sm" placeholder="Badge"
              value={key.key_type}
              onChange={e => { const ks = [...ic.access_keys]; ks[i] = { ...ks[i], key_type: e.target.value }; setField('access_keys', ks) }}
            />
            <Input className="col-span-5 text-sm" placeholder="Entree immeuble"
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
        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un moyen d acces
      </Button>
    </div>
  )

  // ─── Section 2 (inspection) — Accessoires ─────────────────────────────────

  const renderAccessoriesSection = () => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">Accessoires et equipements</p>
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
          <span className="col-span-7">Accessoire</span>
          <span className="col-span-4">Etat</span>
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
        <div className="grid grid-cols-2 gap-3">
          <TF label="Type de chauffage" value={ic.heating.type} placeholder="chaudiere individuelle gaz"
            onChange={v => setField('heating', { ...ic.heating, type: v })} />
          <TF label="Localisation" value={ic.heating.location} placeholder="cuisine"
            onChange={v => setField('heating', { ...ic.heating, location: v })} />
          <TF label="Etat general" value={ic.heating.general_condition} placeholder="neuf"
            onChange={v => setField('heating', { ...ic.heating, general_condition: v })} />
          <TF label="Nombre de radiateurs" value={String(ic.heating.radiator_count)} type="number"
            onChange={v => setField('heating', { ...ic.heating, radiator_count: parseInt(v) || 0 })} />
          <div className="col-span-2">
            <TF label="Etat des radiateurs" value={ic.heating.radiator_condition} placeholder="bon etat"
              onChange={v => setField('heating', { ...ic.heating, radiator_condition: v })} />
          </div>
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Compteurs</p>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1.5 text-xs font-medium text-slate-500 px-1">
            <span className="col-span-2">Energie</span>
            <span className="col-span-2">Fournisseur</span>
            <span className="col-span-3">Localisation</span>
            <span className="col-span-2">Releve</span>
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
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
            <span className="col-span-3">Element</span>
            <span className="col-span-3">Description</span>
            <span className="col-span-2">Etat</span>
            <span className="col-span-3">Commentaire</span>
            <span className="col-span-1" />
          </div>
          {room.elements.map((el: any, j: number) => (
            <div key={j} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-3 text-xs" value={el.name}
                onChange={e => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], name: e.target.value }; return { ...r, elements: els } })} />
              <Input className="col-span-3 text-xs" placeholder="..."
                value={el.description}
                onChange={e => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], description: e.target.value }; return { ...r, elements: els } })} />
              <div className="col-span-2">
                <Select value={el.condition}
                  onValueChange={(v: string | null) => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], condition: (v ?? 'A') as InspectionCondition }; return { ...r, elements: els } })}>
                  <SelectTrigger className="w-full h-8"><span className="text-xs">{el.condition}</span></SelectTrigger>
                  <SelectContent>{CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input className="col-span-3 text-xs" placeholder="..."
                value={el.comment}
                onChange={e => updateRoom(idx, r => { const els = [...r.elements]; els[j] = { ...els[j], comment: e.target.value }; return { ...r, elements: els } })} />
              <Button type="button" variant="ghost" size="icon" className="col-span-1 h-7 w-7 text-red-400"
                onClick={() => updateRoom(idx, r => ({ ...r, elements: r.elements.filter((_: any, k: number) => k !== j) }))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm"
          onClick={() => updateRoom(idx, r => ({ ...r, elements: [...r.elements, { name: '', description: '', condition: 'A' as InspectionCondition, comment: '' }] }))}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un element
        </Button>

        <LF label="Observations de la piece">
          <Textarea value={room.remarks} rows={2} className="text-sm resize-none"
            onChange={e => updateRoom(idx, r => ({ ...r, remarks: e.target.value }))} />
        </LF>

        {idx === ic.rooms.length - 1 && (
          <>
            <Separator />
            <Button type="button" variant="outline" size="sm" onClick={addRoom}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une piece
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
            <span className="col-span-1">Qte</span>
            <span className="col-span-3">Etat</span>
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
              <Input className="col-span-3 text-xs" placeholder="..." value={item.comment}
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
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une piece
            </Button>
          </>
        )}
      </div>
    )
  }

  // ─── Last section — Observations et signatures ────────────────────────────

  const renderObservationsSection = () => (
    <div className="space-y-5">
      <LF label="Observations generales">
        <Textarea value={content.general_observations} rows={4} className="text-sm resize-none"
          onChange={e => setField('general_observations', e.target.value)} />
      </LF>

      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
        Le present etat des lieux etabli contradictoirement entre les parties qui le reconnaissent,
        fait partie integrante du contrat de location dont il ne peut etre dissocie.
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Signature du bailleur</p>
        {ownerSig && (
          <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
            <img src={ownerSig} alt="Signature bailleur" className="h-14 object-contain" />
          </div>
        )}
        <SignatureCanvas onSave={setOwnerSig} existingSignature={ownerSig} />
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Signature du locataire</p>
        {tenantSig && (
          <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
            <img src={tenantSig} alt="Signature locataire" className="h-14 object-contain" />
          </div>
        )}
        <SignatureCanvas onSave={setTenantSig} existingSignature={tenantSig} />
      </div>
    </div>
  )

  // ─── Section dispatcher ────────────────────────────────────────────────────

  const renderSection = () => {
    if (sectionIndex === 0) return renderInfoSection()
    if (isInventory) {
      if (isRoomSec) return renderInventoryRoomSection(roomIdx)
      return renderObservationsSection()
    }
    if (sectionIndex === 1) return renderAccessSection()
    if (sectionIndex === 2) return renderAccessoriesSection()
    if (sectionIndex === 3) return renderHeatingMetersSection()
    if (isRoomSec) return renderInspectionRoomSection(roomIdx)
    return renderObservationsSection()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <ProgressBar current={sectionIndex} total={totalSec} label={sectionLabel} />

      <div className="min-h-[300px]">
        {renderSection()}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm"
            onClick={() => setSectionIndex(i => Math.max(0, i - 1))}
            disabled={sectionIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Precedent
          </Button>
          {!isLastSec && (
            <Button type="button" size="sm"
              onClick={() => setSectionIndex(i => Math.min(totalSec - 1, i + 1))}
              className="text-[#063B26] font-semibold"
              style={{ backgroundColor: '#CFFF92' }}>
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm"
            onClick={handleSaveDraft} disabled={saving || generating}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Brouillon
          </Button>
          {isLastSec && (
            <Button type="button" size="sm"
              onClick={handleGenerate}
              disabled={!propertyId || saving || generating}
              className="text-[#063B26] font-semibold"
              style={{ backgroundColor: '#CFFF92' }}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Generer le PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
