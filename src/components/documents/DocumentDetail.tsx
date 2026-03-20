'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'
import SignatureCanvas from './SignatureCanvas'

const typeLabels = {
  lease: 'Contrat de bail',
  entry_inspection: "État des lieux d'entrée",
  exit_inspection: "État des lieux de sortie",
  inventory: 'Inventaire',
}

const statusConfig = {
  draft: { label: 'Brouillon', color: 'secondary' as const },
  sent: { label: 'Envoyé', color: 'default' as const },
  signed: { label: 'Signé', color: 'default' as const },
  finalized: { label: 'Finalisé', color: 'default' as const },
}

interface Props {
  document: any
  onSigned: () => void
}

export default function DocumentDetail({ document: doc, onSigned }: Props) {
  const supabase = createClient()
  const [showOwnerSig, setShowOwnerSig] = useState(false)
  const [ownerSig, setOwnerSig] = useState<string | null>(doc.owner_signature)
  const [loading, setLoading] = useState(false)

  const sc = statusConfig[doc.status as keyof typeof statusConfig]

  const handleSaveSignature = async (sigDataUrl: string) => {
    setLoading(true)
    const { error } = await supabase
      .from('documents')
      .update({
        owner_signature: sigDataUrl,
        status: doc.tenant_signature ? 'finalized' : 'signed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
    } else {
      setOwnerSig(sigDataUrl)
      setShowOwnerSig(false)
      toast.success('Signature enregistrée')

      // Auto-generate finalized PDF
      if (doc.tenant_signature) {
        await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: doc.id }),
        })
      }
      onSigned()
    }
    setLoading(false)
  }

  const content = doc.content ?? {}
  const contentEntries = Object.entries(content)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{typeLabels[doc.type as keyof typeof typeLabels]}</span>
        <Badge variant={sc.color}>{sc.label}</Badge>
      </div>

      {contentEntries.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {contentEntries.map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">{label}</div>
                <div className="text-sm font-medium text-slate-700">{String(value)}</div>
              </div>
            ))}
          </div>
          <Separator />
        </>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold text-slate-700">Signatures</h3>

        {/* Owner signature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Signature du bailleur</p>
            {ownerSig && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </div>
          {ownerSig ? (
            <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
              <img src={ownerSig} alt="Signature bailleur" className="h-16 object-contain" />
            </div>
          ) : null}
          {!ownerSig && !showOwnerSig && (
            <Button variant="outline" size="sm" onClick={() => setShowOwnerSig(true)}>
              Apposer ma signature
            </Button>
          )}
          {showOwnerSig && (
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-2">Signez dans le cadre ci-dessous</p>
              <SignatureCanvas
                onSave={handleSaveSignature}
                existingSignature={ownerSig}
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
            </div>
          )}
          {ownerSig && !showOwnerSig && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowOwnerSig(true)}>
              Modifier la signature
            </Button>
          )}
        </div>

        {/* Tenant signature status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Signature du locataire</p>
            {doc.tenant_signature && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </div>
          {doc.tenant_signature ? (
            <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
              <img src={doc.tenant_signature} alt="Signature locataire" className="h-16 object-contain" />
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-400">
              En attente de signature du locataire (envoyez le document par email)
            </div>
          )}
        </div>
      </div>

      {ownerSig && doc.tenant_signature && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-emerald-700 font-medium">Document signé par les deux parties</p>
        </div>
      )}
    </div>
  )
}
