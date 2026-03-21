'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, CreditCard, Pencil, Trash2, FileText } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import PaymentForm from './PaymentForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const statusConfig = {
  received:           { label: 'Reçu',              className: 'bg-emerald-100 text-emerald-700' },
  pending_validation: { label: 'En attente',         className: 'bg-amber-100 text-amber-700' },
  late:               { label: 'En retard',          className: 'bg-red-100 text-red-600' },
  // legacy
  paid:               { label: 'Payé',               className: 'bg-emerald-100 text-emerald-700' },
  pending:            { label: 'En attente',         className: 'bg-amber-100 text-amber-700' },
}

interface Props {
  payments: any[]
  properties: { id: string; address: string; city: string }[]
  tenants: { id: string; first_name: string; last_name: string; property_id: string | null }[]
  userId: string
}

export default function PaymentList({ payments, properties, tenants, userId }: Props) {
  const [open, setOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('rent_payments').delete().eq('id', deleteId)
    if (error) toast.error('Erreur')
    else { toast.success('Paiement supprimé'); router.refresh() }
    setDeleteId(null)
  }

  const handleGenerateReceipt = async (p: any) => {
    setGeneratingId(p.id)
    try {
      const res = await fetch('/api/receipts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: p.id,
          propertyId: p.property_id,
          tenantId: p.tenant_id,
          periodMonth: p.period_month,
          periodYear: p.period_year,
          sendEmail: false,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Quittance générée')
      router.refresh()
    } catch {
      toast.error('Erreur lors de la génération')
    }
    setGeneratingId(null)
  }

  const filtered = payments.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterYear !== 'all' && p.period_year.toString() !== filterYear) return false
    return true
  })

  const totalReceived = filtered
    .filter(p => p.status === 'received' || p.status === 'paid')
    .reduce((s: number, p: any) => s + Number(p.amount) + Number(p.charges), 0)
  const totalPending = filtered
    .filter(p => p.status !== 'received' && p.status !== 'paid')
    .reduce((s: number, p: any) => s + Number(p.amount) + Number(p.charges), 0)

  const yearsSet = new Set(payments.map((p: any) => p.period_year as number))
  const years = Array.from(yearsSet).sort((a, b) => b - a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-leasy-dark">Paiements</h1>
          <p className="text-leasy-muted mt-1">{payments.length} paiement(s) enregistré(s)</p>
        </div>
        <Button onClick={() => { setEditPayment(null); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Enregistrer un paiement
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-leasy-muted">Encaissé (filtrés)</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{totalReceived.toLocaleString('fr-FR')} €</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-leasy-muted">En attente / retard</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{totalPending.toLocaleString('fr-FR')} €</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-leasy-muted">Total paiements</div>
            <div className="text-2xl font-bold text-leasy-dark mt-1">{filtered.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Historique</CardTitle>
            <div className="flex gap-2">
              <Select value={filterYear} onValueChange={(v) => setFilterYear(v ?? 'all')}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="received">Reçu</SelectItem>
                  <SelectItem value="pending_validation">En attente</SelectItem>
                  <SelectItem value="late">En retard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-10 w-10 text-leasy-border mx-auto mb-3" />
              <p className="text-leasy-muted">Aucun paiement pour ces critères</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Locataire</TableHead>
                  <TableHead>Bien</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Loyer</TableHead>
                  <TableHead>Charges</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => {
                  const sc = statusConfig[p.status as keyof typeof statusConfig] ?? { label: p.status, className: '' }
                  const isReceived = p.status === 'received' || p.status === 'paid'
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.tenant?.first_name} {p.tenant?.last_name}</TableCell>
                      <TableCell className="text-leasy-muted text-sm">{p.property?.address}</TableCell>
                      <TableCell>{MONTHS_FR[p.period_month - 1]} {p.period_year}</TableCell>
                      <TableCell>{Number(p.amount).toLocaleString('fr-FR')} €</TableCell>
                      <TableCell>{Number(p.charges).toLocaleString('fr-FR')} €</TableCell>
                      <TableCell className="font-semibold">{(Number(p.amount) + Number(p.charges)).toLocaleString('fr-FR')} €</TableCell>
                      <TableCell>
                        <Badge className={sc.className}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isReceived && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Générer la quittance"
                              disabled={generatingId === p.id}
                              onClick={() => handleGenerateReceipt(p)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon-sm" onClick={() => { setEditPayment(p); setOpen(true) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-red-500" onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPayment ? 'Modifier le paiement' : 'Enregistrer un paiement'}</DialogTitle>
          </DialogHeader>
          <PaymentForm
            payment={editPayment}
            properties={properties}
            tenants={tenants}
            userId={userId}
            onSuccess={() => { setOpen(false); router.refresh() }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
