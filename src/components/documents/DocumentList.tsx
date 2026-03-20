'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, FolderOpen, Download, Send, Pencil, Trash2, Loader2, FileSignature } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import DocumentForm from './DocumentForm'
import DocumentDetail from './DocumentDetail'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const typeLabels = {
  lease: 'Bail',
  entry_inspection: 'État des lieux entrée',
  exit_inspection: 'État des lieux sortie',
  inventory: 'Inventaire',
}

const statusConfig = {
  draft: { label: 'Brouillon', variant: 'secondary' as const, className: '' },
  sent: { label: 'Envoyé', variant: 'default' as const, className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  signed: { label: 'Signé', variant: 'default' as const, className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  finalized: { label: 'Finalisé', variant: 'default' as const, className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
}

interface Props {
  documents: any[]
  properties: { id: string; address: string; city: string }[]
  tenants: { id: string; first_name: string; last_name: string; property_id: string | null }[]
  userId: string
}

export default function DocumentList({ documents, properties, tenants, userId }: Props) {
  const [openForm, setOpenForm] = useState(false)
  const [openDetail, setOpenDetail] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    if (!deleteId) return
    await supabase.from('documents').delete().eq('id', deleteId)
    toast.success('Document supprimé')
    router.refresh()
    setDeleteId(null)
  }

  const handleGenerate = async (doc: any, sendEmail = false) => {
    setGenerating(doc.id)
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, sendEmail }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(sendEmail ? 'Document généré et envoyé' : 'Document généré')
        router.refresh()
      } else toast.error('Erreur : ' + data.error)
    } catch { toast.error('Erreur') }
    setGenerating(null)
  }

  const handleDownload = async (doc: any) => {
    if (!doc.file_path) {
      await handleGenerate(doc)
      return
    }
    const res = await fetch(`/api/receipts/download?path=${encodeURIComponent(doc.file_path)}`)
    if (!res.ok) { toast.error('Erreur de téléchargement'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
          <p className="text-slate-500 mt-1">{documents.length} document(s)</p>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Créer un document
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">Aucun document créé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bien</TableHead>
                  <TableHead>Locataire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const sc = statusConfig[doc.status as keyof typeof statusConfig]
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{typeLabels[doc.type as keyof typeof typeLabels]}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{doc.property?.address}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{doc.tenant ? `${doc.tenant.first_name} ${doc.tenant.last_name}` : '—'}</TableCell>
                      <TableCell><Badge variant={sc.variant} className={sc.className}>{sc.label}</Badge></TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Voir / Signer"
                            onClick={() => setOpenDetail(doc)}
                          >
                            <FileSignature className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Télécharger"
                            onClick={() => handleDownload(doc)}
                            disabled={generating === doc.id}
                          >
                            {generating === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-blue-600"
                            title="Envoyer par email"
                            onClick={() => handleGenerate(doc, true)}
                            disabled={generating === doc.id}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                            onClick={() => setDeleteId(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un document</DialogTitle>
          </DialogHeader>
          <DocumentForm
            properties={properties}
            tenants={tenants}
            userId={userId}
            onSuccess={() => { setOpenForm(false); router.refresh() }}
          />
        </DialogContent>
      </Dialog>

      {openDetail && (
        <Dialog open={!!openDetail} onOpenChange={() => setOpenDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{openDetail.title}</DialogTitle>
            </DialogHeader>
            <DocumentDetail
              document={openDetail}
              onSigned={() => { setOpenDetail(null); router.refresh() }}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
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
