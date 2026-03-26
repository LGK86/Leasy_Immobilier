'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, X, UserPlus, ChevronDown, ChevronUp } from 'lucide-react'

const docTypes = [
  { value: 'lease', label: 'Contrat de bail' },
  { value: 'entry_inspection', label: "État des lieux d'entrée" },
  { value: 'exit_inspection', label: "État des lieux de sortie" },
  { value: 'inventory', label: 'Inventaire du mobilier' },
]

const defaultFields: Record<string, { key: string; label: string }[]> = {
  lease: [
    { key: 'duration_months', label: 'Durée du bail (mois)' },
    { key: 'monthly_rent', label: 'Loyer mensuel (€)' },
    { key: 'charges', label: 'Charges (€)' },
    { key: 'deposit', label: 'Dépôt de garantie (€)' },
    { key: 'start_date', label: 'Date de début' },
  ],
  entry_inspection: [
    { key: 'inspection_date', label: "Date de l'état des lieux" },
    { key: 'general_condition', label: 'État général' },
    { key: 'keys_given', label: 'Nombre de clés remises' },
    { key: 'meter_reading_elec', label: 'Index électricité' },
    { key: 'meter_reading_gas', label: 'Index gaz' },
    { key: 'meter_reading_water', label: 'Index eau' },
  ],
  exit_inspection: [
    { key: 'inspection_date', label: "Date de l'état des lieux" },
    { key: 'general_condition', label: 'État général' },
    { key: 'keys_returned', label: 'Nombre de clés restituées' },
    { key: 'meter_reading_elec', label: 'Index électricité' },
    { key: 'meter_reading_gas', label: 'Index gaz' },
    { key: 'meter_reading_water', label: 'Index eau' },
    { key: 'deposit_returned', label: 'Dépôt restitué (€)' },
  ],
  inventory: [
    { key: 'item_1', label: 'Article 1' },
    { key: 'item_2', label: 'Article 2' },
    { key: 'item_3', label: 'Article 3' },
  ],
}

interface Props {
  properties: { id: string; address: string; city: string }[]
  tenants: { id: string; first_name: string; last_name: string; property_id: string | null }[]
  userId: string
  onSuccess: (doc?: any) => void
}

const typeLabels: Record<string, string> = {
  lease: 'Contrat de bail',
  entry_inspection: "État des lieux d'entrée",
  exit_inspection: "État des lieux de sortie",
  inventory: 'Inventaire du mobilier',
}

function TriggerLabel({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <span className="flex-1 text-left truncate text-sm">
      {value !== undefined && value !== ''
        ? value
        : <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  )
}

interface NewTenantForm {
  first_name: string
  last_name: string
  email: string
  phone: string
}

export default function DocumentForm({ properties, tenants, userId, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [docType, setDocType] = useState('lease')
  const [propertyId, setPropertyId] = useState('')
  const [tenantIds, setTenantIds] = useState<string[]>([])
  const [title, setTitle] = useState('Contrat de bail')
  const [fields, setFields] = useState(defaultFields['lease'])
  const [values, setValues] = useState<Record<string, string>>({})
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([])

  // Inline tenant creation
  const [showNewTenantForm, setShowNewTenantForm] = useState(false)
  const [newTenant, setNewTenant] = useState<NewTenantForm>({ first_name: '', last_name: '', email: '', phone: '' })
  const [creatingTenant, setCreatingTenant] = useState(false)
  const [localTenants, setLocalTenants] = useState(tenants)

  const handleTypeChange = (type: string | null) => {
    if (!type) return
    setDocType(type)
    const defaults = defaultFields[type] ?? []
    setFields(defaults)
    setValues({})
    const label = docTypes.find(d => d.value === type)?.label ?? ''
    setTitle(label)
  }

  const filteredTenants = localTenants.filter(t => !propertyId || t.property_id === propertyId || t.property_id === null)

  const addTenant = (id: string) => {
    if (!id || tenantIds.includes(id)) return
    setTenantIds(prev => [...prev, id])
  }

  const removeTenant = (id: string) => {
    setTenantIds(prev => prev.filter(t => t !== id))
  }

  const addCustomField = () => {
    setCustomFields(f => [...f, { key: `custom_${Date.now()}`, label: 'Nouveau champ' }])
  }

  const handleCreateTenant = async () => {
    if (!newTenant.first_name || !newTenant.last_name || !newTenant.email) {
      toast.error('Prénom, nom et email sont requis')
      return
    }
    setCreatingTenant(true)
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        owner_id: userId,
        first_name: newTenant.first_name,
        last_name: newTenant.last_name,
        email: newTenant.email,
        phone: newTenant.phone || null,
        property_id: propertyId || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .select('id, first_name, last_name, property_id')
      .single()

    if (error) {
      toast.error('Erreur : ' + error.message)
    } else if (data) {
      setLocalTenants(prev => [...prev, { ...data, property_id: data.property_id ?? null }])
      setTenantIds(prev => [...prev, data.id])
      setNewTenant({ first_name: '', last_name: '', email: '', phone: '' })
      setShowNewTenantForm(false)
      toast.success('Locataire créé et ajouté')
    }
    setCreatingTenant(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const content: Record<string, string | string[]> = {}
    for (const f of [...fields, ...customFields]) {
      if (values[f.key]) content[f.label] = values[f.key]
    }

    // Always store tenant_ids as a proper array in content
    content['tenant_ids'] = [...tenantIds]

    const { data: inserted, error } = await supabase
      .from('documents')
      .insert({
        owner_id: userId,
        property_id: propertyId,
        tenant_id: tenantIds[0] || null,
        type: docType,
        title: title || (docTypes.find(d => d.value === docType)?.label ?? 'Document'),
        content,
        status: 'draft',
      })
      .select('*, property:properties(*), tenant:tenants(*)')
      .single()

    if (error) toast.error('Erreur : ' + error.message)
    else { toast.success('Document créé'); onSuccess(inserted) }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type de document</Label>
          <Select value={docType} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-full">
              <TriggerLabel value={typeLabels[docType]} placeholder="Type de document" />
            </SelectTrigger>
            <SelectContent>
              {docTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Titre</Label>
          <Input
            placeholder="Titre du document"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Bien</Label>
        <Select value={propertyId || undefined} onValueChange={(v) => { setPropertyId(v ?? ''); setTenantIds([]) }}>
          <SelectTrigger className="w-full">
            <TriggerLabel
              value={properties.find(p => p.id === propertyId) ? `${properties.find(p => p.id === propertyId)!.address}, ${properties.find(p => p.id === propertyId)!.city}` : undefined}
              placeholder="Sélectionner un bien"
            />
          </SelectTrigger>
          <SelectContent>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Multi-tenant section */}
      <div className="space-y-2">
        <Label>Locataires</Label>

        {/* Selected tenants list */}
        {tenantIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tenantIds.map(id => {
              const t = localTenants.find(t => t.id === id)
              if (!t) return null
              return (
                <div key={id} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-2 py-1 rounded-full">
                  <span>{t.first_name} {t.last_name}</span>
                  <button
                    type="button"
                    onClick={() => removeTenant(id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add existing tenant */}
        <Select onValueChange={(v) => { if (typeof v === 'string' && v) addTenant(v) }}>
          <SelectTrigger className="w-full">
            <TriggerLabel placeholder="Ajouter un locataire existant" />
          </SelectTrigger>
          <SelectContent>
            {filteredTenants
              .filter(t => !tenantIds.includes(t.id))
              .map(t => (
                <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Toggle inline creation */}
        <button
          type="button"
          onClick={() => setShowNewTenantForm(v => !v)}
          className="flex items-center gap-1.5 text-sm text-[#063B26] hover:underline font-medium mt-1"
        >
          <UserPlus className="h-4 w-4" />
          Créer un nouveau locataire
          {showNewTenantForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showNewTenantForm && (
          <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-600">Nouveau locataire</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Prénom *</Label>
                <Input
                  placeholder="Jean"
                  value={newTenant.first_name}
                  onChange={e => setNewTenant(n => ({ ...n, first_name: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input
                  placeholder="Dupont"
                  value={newTenant.last_name}
                  onChange={e => setNewTenant(n => ({ ...n, last_name: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="jean@exemple.com"
                value={newTenant.email}
                onChange={e => setNewTenant(n => ({ ...n, email: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Téléphone</Label>
              <Input
                placeholder="06 12 34 56 78"
                value={newTenant.phone}
                onChange={e => setNewTenant(n => ({ ...n, phone: e.target.value }))}
                className="text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateTenant}
              disabled={creatingTenant}
              className="text-[#063B26] font-semibold"
              style={{ backgroundColor: '#CFFF92' }}
            >
              {creatingTenant ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Créer et ajouter
            </Button>
          </div>
        )}
      </div>

      {(fields.length > 0 || customFields.length > 0) && (
        <>
          <Separator />
          <p className="text-sm font-medium text-slate-600">Informations du document</p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type={f.key.includes('_date') || f.key === 'start_date' ? 'date' : 'text'}
                  placeholder={f.label}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            {customFields.map((f, i) => (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center gap-1">
                  <Input
                    className="text-xs h-6 border-0 border-b p-0 rounded-none"
                    value={f.label}
                    onChange={e => setCustomFields(cf => cf.map((c, j) => j === i ? { ...c, label: e.target.value } : c))}
                  />
                  <Button
                    type="button" variant="ghost" size="icon" className="h-5 w-5 text-red-400"
                    onClick={() => setCustomFields(cf => cf.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un champ
          </Button>
        </>
      )}

      <Button type="submit" className="w-full" disabled={loading || !propertyId}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Créer le document
      </Button>
    </form>
  )
}
