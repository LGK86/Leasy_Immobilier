'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Building2, MapPin, Euro, Pencil, Trash2, ChevronDown } from 'lucide-react'
import PropertyForm from './PropertyForm'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Property } from '@/types/database'

type PropertyWithDocs = Property & {
  documents?: { id: string; type: string; status: string; content?: any }[]
}

function getLeaseBadge(documents?: { id: string; type: string; status: string; content?: any }[]) {
  const leases = (documents ?? []).filter(d => d.type === 'lease')
  if (leases.length === 0) return { label: 'Aucun bail', className: 'bg-slate-100 text-slate-500 whitespace-nowrap' }
  // Sort by most recent and find an active lease (not closed)
  const activeLease = [...leases].reverse().find(d =>
    ['signed', 'pending_tenant_signature', 'finalized'].includes(d.status) &&
    !d.content?.closed_at
  )
  if (!activeLease) return { label: 'Aucun bail', className: 'bg-slate-100 text-slate-500 whitespace-nowrap' }
  if (activeLease.status === 'finalized') return { label: 'Bail signé', className: 'bg-emerald-100 text-emerald-700 whitespace-nowrap' }
  return { label: 'Bail en attente', className: 'bg-orange-100 text-orange-700 whitespace-nowrap' }
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const typeLabels: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  studio: 'Studio',
  commercial: 'Local commercial',
  other: 'Autre',
}

export default function PropertyList({ properties, userId }: { properties: PropertyWithDocs[]; userId: string }) {
  const [open, setOpen] = useState(false)
  const [editProperty, setEditProperty] = useState<Property | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showRented, setShowRented] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [showVacant, setShowVacant] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const rented = properties.filter(p => p.status === 'rented')
  const upcoming = properties.filter(p => p.status === 'upcoming')
  const vacant = properties.filter(p => p.status === 'vacant')

  const PropertyCard = ({ property }: { property: PropertyWithDocs }) => (
    <Card key={property.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex gap-1.5 flex-wrap mb-2">
              <Badge variant={property.status === 'rented' ? 'default' : 'secondary'} className="rounded-md">
                {property.status === 'rented' ? 'Loué' : 'Vacant'}
              </Badge>
              {(() => {
                const lb = getLeaseBadge(property.documents)
                return <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${lb.className}`}>{lb.label}</span>
              })()}
            </div>
            <CardTitle className="text-base">{typeLabels[property.type] ?? property.type}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setEditProperty(property); setOpen(true) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700"
              onClick={() => setDeleteId(property.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <span>{property.address}, {property.postal_code} {property.city}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Euro className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-800">{Number(property.monthly_rent).toLocaleString('fr-FR')} €/mois</span>
          {Number(property.charges) > 0 && (
            <span className="text-slate-400">+ {Number(property.charges).toLocaleString('fr-FR')} € charges</span>
          )}
        </div>
        {Number(property.deposit) > 0 && (
          <div className="text-xs text-slate-400">
            Dépôt de garantie : {Number(property.deposit).toLocaleString('fr-FR')} €
          </div>
        )}
      </CardContent>
    </Card>
  )

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('properties').delete().eq('id', deleteId)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Bien supprimé')
      router.refresh()
    }
    setDeleteId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mes biens</h1>
          <p className="text-slate-500 mt-1">
            {properties.length} bien(s) — {rented.length} loué(s) · {upcoming.length} à venir · {vacant.length} vacant(s)
          </p>
        </div>
        <Button onClick={() => { setEditProperty(null); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un bien
        </Button>
      </div>

      {properties.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun bien enregistré</h3>
            <p className="text-slate-400 mb-4">Ajoutez votre premier bien immobilier pour commencer</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un bien
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          {rented.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setShowRented(!showRented)}>
                <h2 className="text-lg font-semibold text-slate-700">Loué</h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {rented.length}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform ${showRented ? '' : '-rotate-90'}`} />
              </div>
              {showRented && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rented.map(p => <PropertyCard key={p.id} property={p} />)}
                </div>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setShowUpcoming(!showUpcoming)}>
                <h2 className="text-lg font-semibold text-slate-700">À venir</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {upcoming.length}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform ${showUpcoming ? '' : '-rotate-90'}`} />
              </div>
              {showUpcoming && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcoming.map(p => <PropertyCard key={p.id} property={p} />)}
                </div>
              )}
            </div>
          )}

          {vacant.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setShowVacant(!showVacant)}>
                <h2 className="text-lg font-semibold text-slate-700">Vacant</h2>
                <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {vacant.length}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform ${showVacant ? '' : '-rotate-90'}`} />
              </div>
              {showVacant && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vacant.map(p => <PropertyCard key={p.id} property={p} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProperty ? 'Modifier le bien' : 'Ajouter un bien'}</DialogTitle>
          </DialogHeader>
          <PropertyForm
            property={editProperty}
            userId={userId}
            onSuccess={() => {
              setOpen(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les locataires et paiements associés seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
