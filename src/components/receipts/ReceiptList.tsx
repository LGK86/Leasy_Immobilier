'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileText, Download, Send, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const MONTHS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

interface Props {
  receipts: any[]
  properties: { id: string; address: string; city: string }[]
  tenants: { id: string; first_name: string; last_name: string; property_id: string | null }[]
  payments: any[]
  userId: string
}

export default function ReceiptList({ receipts, properties, tenants, payments, userId }: Props) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [form, setForm] = useState({
    property_id: '',
    tenant_id: '',
    period_month: (new Date().getMonth() + 1).toString(),
    period_year: new Date().getFullYear().toString(),
    send_email: false,
  })
  const router = useRouter()

  const filteredTenants = tenants.filter(t => !form.property_id || t.property_id === form.property_id)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating('manual')

    const matchingPayment = payments.find(p =>
      p.property_id === form.property_id &&
      p.tenant_id === form.tenant_id &&
      p.period_month === parseInt(form.period_month) &&
      p.period_year === parseInt(form.period_year)
    )

    try {
      const res = await fetch('/api/receipts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: matchingPayment?.id,
          propertyId: form.property_id,
          tenantId: form.tenant_id,
          periodMonth: parseInt(form.period_month),
          periodYear: parseInt(form.period_year),
          sendEmail: form.send_email,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(form.send_email ? 'Quittance générée et envoyée' : 'Quittance générée')
        setOpen(false)
        router.refresh()
      } else {
        toast.error('Erreur : ' + (data.error ?? 'Génération échouée'))
      }
    } catch {
      toast.error('Erreur de génération')
    }
    setGenerating(null)
  }

  const handleDownload = async (filePath: string) => {
    const res = await fetch(`/api/receipts/download?path=${encodeURIComponent(filePath)}`)
    if (!res.ok) { toast.error('Erreur de téléchargement'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filePath.split('/').pop() ?? 'quittance.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSendEmail = async (receipt: any) => {
    setGenerating(receipt.id)
    try {
      const res = await fetch('/api/receipts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: receipt.property_id,
          tenantId: receipt.tenant_id,
          periodMonth: receipt.period_month,
          periodYear: receipt.period_year,
          sendEmail: true,
        }),
      })
      const data = await res.json()
      if (data.success) toast.success('Quittance envoyée par email')
      else toast.error('Erreur envoi email')
    } catch { toast.error('Erreur') }
    setGenerating(null)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString())

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quittances</h1>
          <p className="text-slate-500 mt-1">{receipts.length} quittance(s)</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Générer une quittance
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {receipts.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">Aucune quittance générée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Locataire</TableHead>
                  <TableHead>Bien</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Envoyée</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.tenant?.first_name} {r.tenant?.last_name}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{r.property?.address}</TableCell>
                    <TableCell>{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                    <TableCell className="font-semibold">{(Number(r.amount) + Number(r.charges)).toLocaleString('fr-FR')} €</TableCell>
                    <TableCell>
                      {r.sent_at
                        ? <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Envoyée</Badge>
                        : <Badge variant="secondary">Non envoyée</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {r.file_path && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(r.file_path)} title="Télécharger">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600"
                          onClick={() => handleSendEmail(r)}
                          disabled={generating === r.id}
                          title="Envoyer par email"
                        >
                          {generating === r.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Send className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Générer une quittance</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label>Bien</Label>
              <Select value={form.property_id || undefined} onValueChange={(v) => setForm(f => ({ ...f, property_id: v ?? '', tenant_id: '' }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner un bien" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Locataire</Label>
              <Select value={form.tenant_id || undefined} onValueChange={(v) => setForm(f => ({ ...f, tenant_id: v ?? '' }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner un locataire" /></SelectTrigger>
                <SelectContent>
                  {filteredTenants.map(t => <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mois</Label>
                <Select value={form.period_month} onValueChange={(v) => setForm(f => ({ ...f, period_month: v ?? form.period_month }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_FULL.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Année</Label>
                <Select value={form.period_year} onValueChange={(v) => setForm(f => ({ ...f, period_year: v ?? form.period_year }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="send_email"
                checked={form.send_email}
                onChange={e => setForm(f => ({ ...f, send_email: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="send_email" className="text-sm text-slate-600">
                Envoyer par email au locataire
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={!!generating || !form.property_id || !form.tenant_id}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Générer
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
