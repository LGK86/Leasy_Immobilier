'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Users, MapPin, Phone, Mail, Calendar, Pencil, Trash2, ChevronDown } from 'lucide-react'
import TenantForm from './TenantForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Tenant } from '@/types/database'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  tenants: (Tenant & { property?: { address: string; city: string } | null })[]
  properties: { id: string; address: string; city: string }[]
  userId: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:             { label: 'Brouillon',       className: 'bg-slate-100 text-slate-600 whitespace-nowrap' },
  upcoming:          { label: 'Entrée prochaine', className: 'bg-blue-100 text-blue-700 whitespace-nowrap' },
  active:            { label: 'Actif',            className: 'bg-emerald-100 text-emerald-700 whitespace-nowrap' },
  inactive:          { label: 'Inactif',          className: 'bg-red-100 text-red-600 whitespace-nowrap' },
  pending_signature: { label: 'Bail en attente',  className: 'bg-orange-100 text-orange-700 whitespace-nowrap' },
  lease_signed:      { label: 'Bail signé',        className: 'bg-emerald-100 text-emerald-700 whitespace-nowrap' },
}

export default function TenantList({ tenants, properties, userId }: Props) {
  const [open, setOpen] = useState(false)
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showActive, setShowActive] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [showDraft, setShowDraft] = useState(true)
  const [showInactive, setShowInactive] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const active = tenants.filter(t => t.status === 'active' || t.status === 'lease_signed')
  const upcoming = tenants.filter(t => t.status === 'upcoming' || t.status === 'pending_signature')
  const draft = tenants.filter(t => t.status === 'draft')
  const inactive = tenants.filter(t => t.status === 'inactive')

  const TenantCard = ({ tenant }: { tenant: Tenant & { property?: { address: string; city: string } | null } }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">{tenant.first_name} {tenant.last_name}</h3>
            {tenant.status && statusConfig[tenant.status] && (
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${statusConfig[tenant.status].className}`}>
                {statusConfig[tenant.status].label}
              </span>
            )}
            {tenant.property && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                <MapPin className="h-3 w-3" />
                {tenant.property.address}, {tenant.property.city}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTenant(tenant); setOpen(true) }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteId(tenant.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="h-4 w-4 text-slate-400" />
            <a href={`mailto:${tenant.email}`} className="hover:underline">{tenant.email}</a>
          </div>
          {tenant.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="h-4 w-4 text-slate-400" />
              {tenant.phone}
            </div>
          )}
          {tenant.entry_date && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4 text-slate-400" />
              Entrée : {format(new Date(tenant.entry_date), 'dd MMMM yyyy', { locale: fr })}
            </div>
          )}
          {tenant.lease_end_date && (
            <div className="text-xs text-slate-400">
              Fin de bail : {format(new Date(tenant.lease_end_date), 'dd MMMM yyyy', { locale: fr })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('tenants').delete().eq('id', deleteId)
    if (error) toast.error('Erreur lors de la suppression')
    else { toast.success('Locataire supprimé'); router.refresh() }
    setDeleteId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mes locataires</h1>
          <p className="text-slate-500 mt-1">
            {tenants.length} locataire(s) — {active.length} actif(s) · {upcoming.length} à venir · {draft.length} brouillon(s) · {inactive.length} inactif(s)
          </p>
        </div>
        <Button onClick={() => { setEditTenant(null); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un locataire
        </Button>
      </div>

      {tenants.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun locataire</h3>
            <p className="text-slate-400 mb-4">Ajoutez vos locataires pour gérer les loyers</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter un locataire
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          {active.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer group select-none" onClick={() => setShowActive(!showActive)}>
                <h2 className="text-lg font-semibold text-slate-700">Actif</h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">{active.length}</span>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                  <span>{showActive ? 'Masquer' : 'Afficher'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showActive ? '' : '-rotate-90'}`} />
                </div>
              </div>
              {showActive && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {active.map(t => <TenantCard key={t.id} tenant={t} />)}
                </div>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer group select-none" onClick={() => setShowUpcoming(!showUpcoming)}>
                <h2 className="text-lg font-semibold text-slate-700">Entrée prochaine</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{upcoming.length}</span>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                  <span>{showUpcoming ? 'Masquer' : 'Afficher'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showUpcoming ? '' : '-rotate-90'}`} />
                </div>
              </div>
              {showUpcoming && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcoming.map(t => <TenantCard key={t.id} tenant={t} />)}
                </div>
              )}
            </div>
          )}

          {draft.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer group select-none" onClick={() => setShowDraft(!showDraft)}>
                <h2 className="text-lg font-semibold text-slate-700">Brouillon</h2>
                <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">{draft.length}</span>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                  <span>{showDraft ? 'Masquer' : 'Afficher'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showDraft ? '' : '-rotate-90'}`} />
                </div>
              </div>
              {showDraft && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {draft.map(t => <TenantCard key={t.id} tenant={t} />)}
                </div>
              )}
            </div>
          )}

          {inactive.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer group select-none" onClick={() => setShowInactive(!showInactive)}>
                <h2 className="text-lg font-semibold text-slate-700">Inactif</h2>
                <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">{inactive.length}</span>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                  <span>{showInactive ? 'Masquer' : 'Afficher'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showInactive ? '' : '-rotate-90'}`} />
                </div>
              </div>
              {showInactive && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactive.map(t => <TenantCard key={t.id} tenant={t} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTenant ? 'Modifier le locataire' : 'Ajouter un locataire'}</DialogTitle>
          </DialogHeader>
          <TenantForm
            tenant={editTenant}
            properties={properties}
            userId={userId}
            onSuccess={() => { setOpen(false); router.refresh() }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce locataire ?</AlertDialogTitle>
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
