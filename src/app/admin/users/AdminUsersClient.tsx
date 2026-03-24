'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Loader2, Eye, Ban, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface UserRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  created_at: string
  blocked: boolean | null
  propertyCount: number
  tenantCount: number
  properties: any[]
  tenants: any[]
}

function userStatus(u: UserRow) {
  if (u.blocked)          return { label: 'Inactif',  color: 'bg-red-100 text-red-700'     }
  if (u.propertyCount > 0) return { label: 'Actif',   color: 'bg-emerald-100 text-emerald-700' }
  return                         { label: 'Inscrit',  color: 'bg-slate-100 text-slate-600'  }
}

export default function AdminUsersClient({ users: initial }: { users: UserRow[] }) {
  const router = useRouter()
  const [users, setUsers]     = useState<UserRow[]>(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [detail, setDetail]   = useState<UserRow | null>(null)

  const handleToggleBlocked = async (u: UserRow) => {
    setLoading(u.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, blocked: !u.blocked }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, blocked: !p.blocked } : p))
        toast.success(u.blocked ? 'Utilisateur débloqué' : 'Utilisateur bloqué')
        router.refresh()
      } else {
        toast.error('Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setLoading(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Utilisateurs <span className="text-slate-400 font-normal text-lg">({users.length})</span>
      </h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Inscription</TableHead>
                <TableHead className="text-center">Biens</TableHead>
                <TableHead className="text-center">Locataires</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const st = userStatus(u)
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-700">
                      {u.first_name || u.last_name
                        ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                        : <span className="text-slate-400 italic">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{u.email}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-center text-sm">{u.propertyCount}</TableCell>
                    <TableCell className="text-center text-sm">{u.tenantCount}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          title="Voir détail"
                          onClick={() => setDetail(u)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className={`h-8 w-8 ${u.blocked ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-500 hover:text-red-600'}`}
                          title={u.blocked ? 'Débloquer' : 'Bloquer'}
                          disabled={loading === u.id}
                          onClick={() => handleToggleBlocked(u)}
                        >
                          {loading === u.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : u.blocked
                              ? <CheckCircle className="h-4 w-4" />
                              : <Ban className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-12">
                    Aucun utilisateur
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {detail.first_name || detail.last_name
                  ? `${detail.first_name ?? ''} ${detail.last_name ?? ''}`.trim()
                  : detail.email
                }
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">Email</p>
                <p className="font-medium">{detail.email}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Inscrit le</p>
                <p className="font-medium">
                  {format(new Date(detail.created_at), "dd MMMM yyyy 'à' HH'h'mm", { locale: fr })}
                </p>
              </div>

              {/* Properties */}
              <div>
                <p className="font-semibold text-slate-700 mb-2">
                  Biens ({detail.properties.length})
                </p>
                {detail.properties.length === 0 ? (
                  <p className="text-slate-400 italic">Aucun bien</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.properties.map((p: any) => (
                      <li key={p.id} className="flex items-center gap-2 text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                        {p.address ?? p.id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Tenants */}
              <div>
                <p className="font-semibold text-slate-700 mb-2">
                  Locataires ({detail.tenants.length})
                </p>
                {detail.tenants.length === 0 ? (
                  <p className="text-slate-400 italic">Aucun locataire</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.tenants.map((t: any) => (
                      <li key={t.id} className="flex items-center gap-2 text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                        {t.first_name} {t.last_name}
                        {t.email && <span className="text-slate-400">({t.email})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
