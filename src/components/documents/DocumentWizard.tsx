'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, Trash2, User } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type KeyEntry     = { type: string; destination: string; nombre: string }
type ElementState = { etat: string; desc: string }
type PiecesState  = Record<string, Record<string, ElementState>>
type InventoryRow = { objet: string; quantite: string; etat: string; commentaires: string }

interface Props {
  doc: any
  onSave: (content: Record<string, string>) => void
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
  { key: 'Entree',         label: 'Entrée' },
  { key: 'Sejour',         label: 'Séjour' },
  { key: 'Cuisine',        label: 'Cuisine' },
  { key: 'Salle_de_bain',  label: 'Salle de bain' },
  { key: 'Chambre',        label: 'Chambre' },
  { key: 'Dressing',       label: 'Dressing' },
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
    return ['Parties', 'Le logement', 'Durée', 'Finances', 'Services', 'Conditions']
  }
  if (type === 'entry_inspection' || type === 'exit_inspection') {
    return ['Parties', 'Locaux', 'Accès', 'Accessoires', 'Chauffage', 'Compteurs', 'État des pièces', 'Observations']
  }
  if (type === 'inventory') {
    return ['Parties', 'Séjour', 'Cuisine', 'Chambre', 'Autres', 'Observations']
  }
  return ['Informations']
}

// ─── State initializers for complex sections ──────────────────────────────────

function initKeyEntries(content: Record<string, string>): KeyEntry[] {
  try { if (content['acces']) return JSON.parse(content['acces']) } catch {}
  return [{ type: '', destination: '', nombre: '1' }]
}

function initPiecesState(content: Record<string, string>): PiecesState {
  try { if (content['etat_pieces']) return JSON.parse(content['etat_pieces']) } catch {}
  const state: PiecesState = {}
  for (const r of ROOMS) {
    state[r.key] = {}
    for (const el of ELEMENTS) {
      state[r.key][el.key] = { etat: 'B', desc: '' }
    }
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

// ─── Small helpers ────────────────────────────────────────────────────────────

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function TF({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <LabeledField label={label}>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm"
      />
    </LabeledField>
  )
}

function SF({
  label, value, options, onChange,
}: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  const found = options.find(o => o.value === value)
  return (
    <LabeledField label={label}>
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
    </LabeledField>
  )
}

function TA({
  label, value, onChange, rows = 4, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <LabeledField label={label}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </LabeledField>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentWizard({ doc, onSave }: Props) {
  const supabase = createClient()

  // Flatten doc.content to Record<string, string>
  const flatContent = (): Record<string, string> => {
    const c = doc.content ?? {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(c)) {
      out[k] = Array.isArray(v) ? (v as string[]).join(',') : String(v ?? '')
    }
    return out
  }

  const [section, setSection] = useState(1)
  const [form, setForm]       = useState<Record<string, string>>(flatContent)
  const [profile, setProfile]             = useState<any>(null)
  const [tenantDetails, setTenantDetails] = useState<any[]>([])
  const [loadingData, setLoadingData]     = useState(true)

  // Complex section state
  const [keyEntries,    setKeyEntries]    = useState<KeyEntry[]>(() => initKeyEntries(doc.content ?? {}))
  const [piecesState,   setPiecesState]   = useState<PiecesState>(() => initPiecesState(doc.content ?? {}))
  const [inventoryRows, setInventoryRows] = useState<Record<string, InventoryRow[]>>(() => initInventoryRows(doc.content ?? {}))

  const sections = getSections(doc.type)
  const total    = sections.length

  // Fetch owner profile + tenant details
  useEffect(() => {
    const load = async () => {
      setLoadingData(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(prof)
      }

      const rawIds = doc.content?.tenant_ids
      let ids: string[] = []
      if (Array.isArray(rawIds))                               ids = rawIds
      else if (typeof rawIds === 'string' && rawIds.length > 0) ids = rawIds.split(',').map((s: string) => s.trim()).filter(Boolean)

      if (ids.length > 0) {
        const { data } = await supabase.from('tenants').select('id, first_name, last_name, email, phone').in('id', ids)
        setTenantDetails(data ?? [])
      }
      setLoadingData(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const f = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }))

  // Merge serialized complex data before saving
  const buildFinalContent = (): Record<string, string> => {
    const out = { ...form }
    if (doc.type === 'entry_inspection' || doc.type === 'exit_inspection') {
      out['acces']       = JSON.stringify(keyEntries)
      out['etat_pieces'] = JSON.stringify(piecesState)
    }
    if (doc.type === 'inventory') {
      for (const r of INVENTORY_ROOMS) {
        out[`mobilier_${r.key}`] = JSON.stringify(inventoryRows[r.key] ?? [])
      }
    }
    return out
  }

  const handleNext = () => {
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
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(section / total) * 100}%`, backgroundColor: '#063B26' }}
        />
      </div>
      <div className="flex gap-0.5 mt-1.5">
        {sections.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-200"
            style={{ backgroundColor: i + 1 <= section ? '#063B26' : '#e2e8f0' }}
          />
        ))}
      </div>
    </div>
  )

  // ── Nav buttons ───────────────────────────────────────────────────────────

  const Nav = () => (
    <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
      {section > 1 && (
        <Button variant="outline" size="sm" onClick={() => setSection(s => s - 1)} className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
      )}
      <Button
        size="sm"
        onClick={handleNext}
        className="ml-auto flex items-center gap-1 text-[#063B26] font-semibold"
        style={{ backgroundColor: '#CFFF92' }}
      >
        {section < total ? (
          <>Suivant <ChevronRight className="h-4 w-4" /></>
        ) : 'Enregistrer et continuer'}
      </Button>
    </div>
  )

  // ── Section 1 : Parties (read-only, all types) ────────────────────────────

  const renderParties = () => (
    <div className="space-y-4">
      {/* Bailleur */}
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
            {profile.address && (
              <p className="text-slate-500">{profile.address}{profile.postal_code ? `, ${profile.postal_code}` : ''}{profile.city ? ` ${profile.city}` : ''}</p>
            )}
            {profile.email && <p className="text-slate-500">{profile.email}</p>}
            {profile.phone && <p className="text-slate-500">{profile.phone}</p>}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Profil non renseigné</p>
        )}
      </div>

      {/* Locataires */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {tenantDetails.length > 1 ? 'Locataires' : 'Locataire'}
          </span>
        </div>
        {loadingData ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : tenantDetails.length > 0 ? (
          <div className="space-y-3">
            {tenantDetails.map(t => (
              <div key={t.id} className="space-y-0.5 text-sm">
                <p className="font-medium text-slate-700">{t.first_name} {t.last_name}</p>
                {t.email && <p className="text-slate-500">{t.email}</p>}
                {t.phone && <p className="text-slate-500">{t.phone}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Aucun locataire associé</p>
        )}
      </div>
    </div>
  )

  // ── LEASE sections ────────────────────────────────────────────────────────

  const renderLease = () => {
    if (section === 1) return renderParties()

    if (section === 2) return (
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TF label="Surface habitable (m²)" value={form['Surface habitable'] ?? ''} onChange={f('Surface habitable')} placeholder="ex: 35" />
          <TF label="Nombre de pièces"        value={form['Nombre de pieces'] ?? ''} onChange={f('Nombre de pieces')} placeholder="ex: 2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SF
            label="Type d'habitat"
            value={form['Type d habitat'] ?? ''}
            options={[
              { value: 'Immeuble collectif', label: 'Immeuble collectif' },
              { value: 'Individuel',         label: 'Individuel' },
            ]}
            onChange={f('Type d habitat')}
          />
          <SF
            label="Régime"
            value={form['Regime'] ?? ''}
            options={[
              { value: 'Copropriete',  label: 'Copropriété' },
              { value: 'Monopropriete', label: 'Monopropriété' },
            ]}
            onChange={f('Regime')}
          />
        </div>
        <SF
          label="Période de construction"
          value={form['Periode de construction'] ?? ''}
          options={[
            { value: 'Avant 1949',  label: 'Avant 1949' },
            { value: '1949-1974',   label: '1949-1974' },
            { value: '1975-1989',   label: '1975-1989' },
            { value: '1989-2005',   label: '1989-2005' },
            { value: 'Depuis 2005', label: 'Depuis 2005' },
          ]}
          onChange={f('Periode de construction')}
        />
        <TA label="Description du logement" value={form['Description du logement'] ?? ''} onChange={f('Description du logement')} rows={2} placeholder="Description générale..." />
        <TF label="Autres parties"          value={form['Autres parties'] ?? ''}          onChange={f('Autres parties')}          placeholder="ex: Cave, parking..." />
        <TF label="Équipements"             value={form['Equipements'] ?? ''}             onChange={f('Equipements')}             placeholder="ex: Lave-linge, réfrigérateur..." />
      </div>
    )

    if (section === 3) return (
      <div className="grid grid-cols-1 gap-3">
        <TF label="Date d'entrée"           value={form["Date d'entree"] ?? ''}       onChange={f("Date d'entree")}       type="date" />
        <TF label="Durée du bail (mois)"    value={form['Duree du bail (mois)'] ?? '12'} onChange={f('Duree du bail (mois)')} type="number" placeholder="12" />
      </div>
    )

    if (section === 4) return (
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TF label="Loyer mensuel (€)"     value={form['Loyer mensuel (€)'] ?? ''}     onChange={f('Loyer mensuel (€)')}     placeholder="ex: 800" />
          <TF label="Charges (€)"           value={form['Charges (€)'] ?? ''}           onChange={f('Charges (€)')}           placeholder="ex: 60" />
        </div>
        <TF label="Dépôt de garantie (€)"   value={form['Depot de garantie (€)'] ?? ''} onChange={f('Depot de garantie (€)')} placeholder="ex: 800" />
        <SF
          label="Encadrement des loyers"
          value={form['Encadrement des loyers'] ?? ''}
          options={[
            { value: 'Non', label: 'Non' },
            { value: 'Oui', label: 'Oui' },
          ]}
          onChange={f('Encadrement des loyers')}
        />
      </div>
    )

    if (section === 5) return (
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SF
            label="Chauffage"
            value={form['Chauffage'] ?? ''}
            options={[
              { value: 'Individuel', label: 'Individuel' },
              { value: 'Collectif',  label: 'Collectif' },
            ]}
            onChange={f('Chauffage')}
          />
          <SF
            label="Eau chaude"
            value={form['Eau chaude'] ?? ''}
            options={[
              { value: 'Individuelle', label: 'Individuelle' },
              { value: 'Collective',   label: 'Collective' },
            ]}
            onChange={f('Eau chaude')}
          />
        </div>
        <TF label="Locaux privatifs" value={form['Locaux privatifs'] ?? ''} onChange={f('Locaux privatifs')} placeholder="ex: Logement complet" />
        <TF label="Parties communes" value={form['Parties communes'] ?? ''} onChange={f('Parties communes')} placeholder="ex: Hall, escaliers" />
        <SF
          label="Internet"
          value={form['Internet'] ?? ''}
          options={[
            { value: 'Fibre', label: 'Fibre' },
            { value: 'ADSL',  label: 'ADSL' },
            { value: 'Aucun', label: 'Aucun' },
          ]}
          onChange={f('Internet')}
        />
      </div>
    )

    if (section === 6) return (
      <div className="space-y-3">
        <TA
          label="Conditions particulières"
          value={form['Conditions particulieres'] ?? ''}
          onChange={f('Conditions particulieres')}
          rows={5}
          placeholder="Conditions particulières du contrat..."
        />
        <SF
          label="Caution solidaire"
          value={form['Caution solidaire'] ?? ''}
          options={[
            { value: 'Non', label: 'Non' },
            { value: 'Oui', label: 'Oui' },
          ]}
          onChange={f('Caution solidaire')}
        />
      </div>
    )

    return null
  }

  // ── INSPECTION sections ───────────────────────────────────────────────────

  const renderInspection = () => {
    if (section === 1) return renderParties()

    if (section === 2) return (
      <div className="grid grid-cols-1 gap-3">
        <TF label="Type de logement"   value={form['Type de logement'] ?? ''}   onChange={f('Type de logement')}   placeholder="ex: Appartement T2" />
        <TF label="Adresse"            value={form['Adresse'] ?? (doc.property?.address ?? '')} onChange={f('Adresse')} />
        <div className="grid grid-cols-2 gap-3">
          <TF label="Surface (m²)"     value={form['Surface'] ?? ''}            onChange={f('Surface')} />
          <TF label="Nombre de pièces" value={form['Nombre de pieces'] ?? ''}   onChange={f('Nombre de pieces')} />
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
                  <td className="py-1 pr-2">
                    <Input
                      value={entry.type}
                      onChange={e => { const n = [...keyEntries]; n[i] = { ...n[i], type: e.target.value }; setKeyEntries(n) }}
                      placeholder="ex: Clé"
                      className="text-sm h-8"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      value={entry.destination}
                      onChange={e => { const n = [...keyEntries]; n[i] = { ...n[i], destination: e.target.value }; setKeyEntries(n) }}
                      placeholder="ex: Entrée principale"
                      className="text-sm h-8"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      value={entry.nombre}
                      onChange={e => { const n = [...keyEntries]; n[i] = { ...n[i], nombre: e.target.value }; setKeyEntries(n) }}
                      type="number"
                      className="text-sm h-8"
                    />
                  </td>
                  <td className="py-1">
                    <button onClick={() => setKeyEntries(keyEntries.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
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
          { key: 'Sonnette',         label: 'Sonnette' },
          { key: 'Boite aux lettres', label: 'Boîte aux lettres' },
          { key: 'Detecteur fumee',  label: 'Détecteur de fumée' },
          { key: 'Detecteur CO',     label: 'Détecteur CO' },
        ].map(({ key, label }) => (
          <SF key={key} label={label} value={form[key] ?? ''} options={ETATS_OPTIONS} onChange={f(key)} />
        ))}
      </div>
    )

    if (section === 5) return (
      <div className="grid grid-cols-1 gap-3">
        <TF label="Type de chauffage"   value={form['Type de chauffage'] ?? ''}      onChange={f('Type de chauffage')}      placeholder="ex: Électrique" />
        <TF label="Localisation"        value={form['Localisation chauffage'] ?? ''} onChange={f('Localisation chauffage')} placeholder="ex: Salon, chambres" />
        <SF label="État général"        value={form['Etat chauffage'] ?? ''}         options={ETATS_OPTIONS}                onChange={f('Etat chauffage')} />
        <TF label="Nombre de radiateurs" value={form['Nombre de radiateurs'] ?? ''}  onChange={f('Nombre de radiateurs')}   placeholder="ex: 4" />
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
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 pb-1 border-b border-slate-100">
              {room.label}
            </div>
            <div className="space-y-2">
              {ELEMENTS.map(el => (
                <div key={el.key} className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-xs text-slate-500">{el.label}</span>
                  <Select
                    value={piecesState[room.key]?.[el.key]?.etat || undefined}
                    onValueChange={(v: string | null) =>
                      setPiecesState(prev => ({
                        ...prev,
                        [room.key]: { ...prev[room.key], [el.key]: { ...prev[room.key]?.[el.key], etat: v ?? 'B' } },
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex-1 text-left text-sm">
                        {piecesState[room.key]?.[el.key]?.etat || <span className="text-muted-foreground">État</span>}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {ETATS_OPTIONS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={piecesState[room.key]?.[el.key]?.desc ?? ''}
                    onChange={e =>
                      setPiecesState(prev => ({
                        ...prev,
                        [room.key]: { ...prev[room.key], [el.key]: { ...prev[room.key]?.[el.key], desc: e.target.value } },
                      }))
                    }
                    placeholder="Remarques..."
                    className="text-sm h-8"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )

    if (section === 8) return (
      <TA
        label="Observations générales"
        value={form['Observations'] ?? ''}
        onChange={f('Observations')}
        rows={6}
        placeholder="Observations générales sur l'état du logement..."
      />
    )

    return null
  }

  // ── INVENTORY sections ────────────────────────────────────────────────────

  const renderInventoryTable = (roomKey: string) => {
    const rows = inventoryRows[roomKey] ?? []
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
                  <td className="py-1 pr-2">
                    <Input value={row.objet} onChange={e => { const n=[...rows]; n[i]={...n[i],objet:e.target.value}; setRows(n) }} placeholder="ex: Canapé" className="text-sm h-8" />
                  </td>
                  <td className="py-1 pr-2">
                    <Input value={row.quantite} onChange={e => { const n=[...rows]; n[i]={...n[i],quantite:e.target.value}; setRows(n) }} type="number" className="text-sm h-8" />
                  </td>
                  <td className="py-1 pr-2">
                    <Select
                      value={row.etat || undefined}
                      onValueChange={(v: string | null) => { const n=[...rows]; n[i]={...n[i],etat:v??'Bon'}; setRows(n) }}
                    >
                      <SelectTrigger className="w-full">
                        <span className="flex-1 text-left text-sm">{row.etat || <span className="text-muted-foreground">État</span>}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {['Neuf','Bon','Moyen','Très abîmé'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input value={row.commentaires} onChange={e => { const n=[...rows]; n[i]={...n[i],commentaires:e.target.value}; setRows(n) }} placeholder="Commentaires..." className="text-sm h-8" />
                  </td>
                  <td className="py-1">
                    <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => setRows([...rows, { objet: '', quantite: '1', etat: 'Bon', commentaires: '' }])}
          className="flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un article
        </Button>
      </div>
    )
  }

  const renderInventory = () => {
    if (section === 1) return renderParties()
    if (section >= 2 && section <= 5) return renderInventoryTable(INVENTORY_ROOMS[section - 2].key)
    if (section === 6) return (
      <TA label="Observations" value={form['Observations'] ?? ''} onChange={f('Observations')} rows={5} placeholder="Observations sur l'inventaire..." />
    )
    return null
  }

  // ── Fallback (unknown type) ───────────────────────────────────────────────

  const renderGeneric = () => (
    <div className="grid grid-cols-1 gap-3">
      {Object.entries(form)
        .filter(([k]) => !['tenant_ids', 'rent_split'].includes(k))
        .map(([key, value]) => (
          <TF key={key} label={key} value={value} onChange={f(key)} />
        ))
      }
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  let sectionContent: React.ReactNode

  if (doc.type === 'lease') {
    sectionContent = renderLease()
  } else if (doc.type === 'entry_inspection' || doc.type === 'exit_inspection') {
    sectionContent = renderInspection()
  } else if (doc.type === 'inventory') {
    sectionContent = renderInventory()
  } else {
    sectionContent = renderGeneric()
  }

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
