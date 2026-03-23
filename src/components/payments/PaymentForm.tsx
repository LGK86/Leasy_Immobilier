'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const MONTHS = [
  { v: '1', l: 'Janvier' }, { v: '2', l: 'Février' }, { v: '3', l: 'Mars' },
  { v: '4', l: 'Avril' }, { v: '5', l: 'Mai' }, { v: '6', l: 'Juin' },
  { v: '7', l: 'Juillet' }, { v: '8', l: 'Août' }, { v: '9', l: 'Septembre' },
  { v: '10', l: 'Octobre' }, { v: '11', l: 'Novembre' }, { v: '12', l: 'Décembre' },
]

const STATUS_LABELS: Record<string, string> = {
  received:           'Paiement reçu',
  pending_validation: 'En attente de validation',
  late:               'En retard',
}

interface Props {
  payment: any
  properties: { id: string; address: string; city: string }[]
  tenants: { id: string; first_name: string; last_name: string; property_id: string | null }[]
  userId: string
  onSuccess: () => void
}

function TriggerLabel({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <span className="flex-1 text-left truncate text-sm">
      {value ?? <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  )
}

export default function PaymentForm({ payment, properties, tenants, userId, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    property_id: payment?.property_id ?? '',
    tenant_id: payment?.tenant_id ?? '',
    amount: payment?.amount?.toString() ?? '',
    charges: payment?.charges?.toString() ?? '0',
    period_month: payment?.period_month?.toString() ?? (new Date().getMonth() + 1).toString(),
    period_year: payment?.period_year?.toString() ?? new Date().getFullYear().toString(),
    status: payment?.status ?? 'pending_validation',
    payment_date: payment?.payment_date ?? new Date().toISOString().split('T')[0],
    notes: payment?.notes ?? '',
  })

  const filteredTenants = tenants.filter(t =>
    !form.property_id || t.property_id === form.property_id
  )

  // Computed display labels
  const selectedProperty = properties.find(p => p.id === form.property_id)
  const selectedTenant = filteredTenants.find(t => t.id === form.tenant_id)
  const selectedMonth = MONTHS.find(m => m.v === form.period_month)

  useEffect(() => {
    if (form.property_id && !payment) {
      supabase
        .from('properties')
        .select('monthly_rent, charges')
        .eq('id', form.property_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setForm(f => ({
              ...f,
              amount: String(data.monthly_rent),
              charges: String(data.charges),
            }))
          }
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.property_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const data = {
      owner_id: userId,
      property_id: form.property_id,
      tenant_id: form.tenant_id,
      amount: parseFloat(form.amount) || 0,
      charges: parseFloat(form.charges) || 0,
      period_month: parseInt(form.period_month),
      period_year: parseInt(form.period_year),
      status: form.status,
      payment_date: form.status === 'received' ? form.payment_date : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    let error
    let paymentId: string | undefined = payment?.id
    if (payment) {
      const res = await supabase.from('rent_payments').update(data).eq('id', payment.id)
      error = res.error
    } else {
      const res = await supabase.from('rent_payments').insert(data).select('id').single()
      error = res.error
      paymentId = res.data?.id
    }

    if (error) {
      toast.error('Erreur : ' + error.message)
      setLoading(false)
      return
    }

    toast.success(payment ? 'Paiement modifié' : 'Paiement enregistré')

    if (form.status === 'received' && paymentId) {
      try {
        const res = await fetch('/api/receipts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId,
            propertyId: form.property_id,
            tenantId: form.tenant_id,
            periodMonth: parseInt(form.period_month),
            periodYear: parseInt(form.period_year),
            sendEmail: true,
          }),
        })
        if (res.ok) {
          toast.success('Quittance générée et envoyée au locataire')
        } else {
          toast.warning('Paiement enregistré mais erreur lors de la génération de la quittance')
        }
      } catch {
        toast.warning('Paiement enregistré mais erreur lors de la génération de la quittance')
      }
    }

    onSuccess()
    setLoading(false)
  }

  const setSelect = (key: string) => (v: string | null) => {
    setForm(f => ({ ...f, [key]: v ?? '' }))
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString())

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Bien</Label>
        <Select
          value={form.property_id || undefined}
          onValueChange={(v) => setForm(f => ({ ...f, property_id: v ?? '', tenant_id: '' }))}
        >
          <SelectTrigger className="w-full">
            <TriggerLabel
              value={selectedProperty ? `${selectedProperty.address}, ${selectedProperty.city}` : undefined}
              placeholder="Sélectionner un bien"
            />
          </SelectTrigger>
          <SelectContent>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Locataire</Label>
        <Select value={form.tenant_id || undefined} onValueChange={setSelect('tenant_id')}>
          <SelectTrigger className="w-full">
            <TriggerLabel
              value={selectedTenant ? `${selectedTenant.first_name} ${selectedTenant.last_name}` : undefined}
              placeholder="Sélectionner un locataire"
            />
          </SelectTrigger>
          <SelectContent>
            {filteredTenants.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Mois</Label>
          <Select value={form.period_month} onValueChange={setSelect('period_month')}>
            <SelectTrigger className="w-full">
              <TriggerLabel value={selectedMonth?.l} placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Année</Label>
          <Select value={form.period_year} onValueChange={setSelect('period_year')}>
            <SelectTrigger className="w-full">
              <TriggerLabel value={form.period_year} placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Loyer (€)</Label>
          <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required min="0" step="0.01" />
        </div>
        <div className="space-y-2">
          <Label>Charges (€)</Label>
          <Input type="number" value={form.charges} onChange={e => setForm(f => ({ ...f, charges: e.target.value }))} min="0" step="0.01" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={setSelect('status')}>
            <SelectTrigger className="w-full">
              <TriggerLabel value={STATUS_LABELS[form.status]} placeholder="" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="received">Paiement reçu</SelectItem>
              <SelectItem value="pending_validation">En attente de validation</SelectItem>
              <SelectItem value="late">En retard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.status === 'received' && (
          <div className="space-y-2">
            <Label>Date de paiement</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notes (optionnel)</Label>
        <Textarea placeholder="Remarques..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      </div>

      <Button type="submit" className="w-full" disabled={loading || !form.property_id || !form.tenant_id}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {payment ? 'Enregistrer' : 'Ajouter'}
      </Button>
    </form>
  )
}
