'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

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

export default function DocumentForm({ properties, tenants, userId, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [docType, setDocType] = useState('lease')
  const [propertyId, setPropertyId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [title, setTitle] = useState('Contrat de bail')
  const [fields, setFields] = useState(defaultFields['lease'])
  const [values, setValues] = useState<Record<string, string>>({})
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([])

  const handleTypeChange = (type: string | null) => {
    if (!type) return
    setDocType(type)
    const defaults = defaultFields[type] ?? []
    setFields(defaults)
    setValues({})
    const label = docTypes.find(d => d.value === type)?.label ?? ''
    setTitle(label)
  }

  const filteredTenants = tenants.filter(t => !propertyId || t.property_id === propertyId)

  const addCustomField = () => {
    setCustomFields(f => [...f, { key: `custom_${Date.now()}`, label: 'Nouveau champ' }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const content: Record<string, string> = {}
    for (const f of [...fields, ...customFields]) {
      if (values[f.key]) content[f.label] = values[f.key]
    }

    const { data: inserted, error } = await supabase
      .from('documents')
      .insert({
        owner_id: userId,
        property_id: propertyId,
        tenant_id: tenantId || null,
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
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Bien</Label>
          <Select value={propertyId || undefined} onValueChange={(v) => { setPropertyId(v ?? ''); setTenantId('') }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Locataire (optionnel)</Label>
          <Select value={tenantId || undefined} onValueChange={(v) => setTenantId(v ?? '')}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucun</SelectItem>
              {filteredTenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
