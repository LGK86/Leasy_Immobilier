'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, ChevronLeft, Send, Clock } from 'lucide-react'
import SignatureCanvas from './SignatureCanvas'
import DocumentWizard from './DocumentWizard'

const typeLabels = {
  lease: 'Contrat de bail',
  entry_inspection: "État des lieux d'entrée",
  exit_inspection: "État des lieux de sortie",
  inventory: 'Inventaire',
}

const statusConfig = {
  draft:                    { label: 'Brouillon',                       color: 'secondary' as const },
  sent:                     { label: 'Envoyé',                          color: 'default' as const },
  signed:                   { label: 'Signé',                           color: 'default' as const },
  pending_tenant_signature: { label: 'En attente signature locataire',  color: 'default' as const },
  finalized:                { label: 'Finalisé',                        color: 'default' as const },
}

interface Props {
  document: any | null
  onSigned: () => void
  properties?: { id: string; address: string; city: string }[]
  tenants?: { id: string; first_name: string; last_name: string; property_id: string | null; email?: string | null; phone?: string | null }[]
  userId?: string
}

function initialStep(doc: any | null): 1 | 2 | 3 {
  if (!doc) return 1
  if (doc.owner_signature) return 3
  if (doc.status === 'draft') return 1
  return 2
}

/* ─── Step indicator ─────────────────────────────────────────── */
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Revue' },
    { n: 2, label: 'Signature' },
    { n: 3, label: 'Envoi' },
  ] as const

  return (
    <div className="flex items-center gap-1 mb-5">
      {steps.map((s, i) => {
        const done    = current > s.n
        const active  = current === s.n
        return (
          <div key={s.n} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              done   ? 'bg-emerald-100 text-emerald-700' :
              active ? 'text-white'                      : 'bg-slate-100 text-slate-400'
            }`} style={active ? { backgroundColor: '#063B26' } : {}}>
              {done
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : <span className="h-4 w-4 flex items-center justify-center rounded-full border text-[10px]
                    border-current">{s.n}</span>
              }
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-4 ${current > s.n ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */
export default function DocumentDetail({ document: doc, onSigned, properties, tenants, userId }: Props) {
  const supabase = createClient()
  const [step, setStep]           = useState<1 | 2 | 3>(initialStep(doc))
  const [docState, setDocState]   = useState<any>(doc)
  const [ownerSig, setOwnerSig]   = useState<string | null>(doc?.owner_signature ?? null)
  const [showCanvas, setShowCanvas] = useState(!doc?.owner_signature)
  const [loading, setLoading]     = useState(false)
  const [sending, setSending]     = useState(false)

  const sc = docState ? statusConfig[docState.status as keyof typeof statusConfig] : null

  /* ── Wizard: doc created in creation mode ────────────────── */
  const handleDocCreated = (newDoc: any) => {
    setDocState(newDoc)
  }

  /* ── Step 1 : wizard complete ────────────────────────────── */
  const handleSaveContent = async (newContent: Record<string, string>) => {
    setLoading(true)
    const docId = docState?.id
    if (!docId) { toast.error('Document non initialisé'); setLoading(false); return }

    const { error } = await supabase
      .from('documents')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', docId)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
      setLoading(false)
      return
    }

    // Refresh local doc state to pick up property_id / tenant_ids saved by wizard auto-save
    const { data: freshDoc } = await supabase
      .from('documents')
      .select('*, property:properties(*), tenant:tenants(*)')
      .eq('id', docId)
      .single()
    if (freshDoc) setDocState(freshDoc)

    toast.success('Informations mises à jour')
    setStep(2)
    setLoading(false)
  }

  /* ── Step 2 : save owner signature ──────────────────────── */
  const handleSaveSignature = async (sigDataUrl: string) => {
    setLoading(true)
    const { error } = await supabase
      .from('documents')
      .update({
        owner_signature: sigDataUrl,
        status: docState.tenant_signature ? 'finalized' : 'signed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', docState.id)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
    } else {
      setOwnerSig(sigDataUrl)
      setShowCanvas(false)
      toast.success('Signature enregistrée')

      // Mettre à jour le statut des locataires associés
      const rawIds = docState.content?.tenant_ids
      const tenantIds: string[] = Array.isArray(rawIds)
        ? rawIds
        : typeof rawIds === 'string' && rawIds
          ? rawIds.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []

      if (tenantIds.length > 0) {
        const docStatus = docState.tenant_signature ? 'finalized' : 'signed'
        // Only update to 'active' when document is fully finalized (both parties signed)
        if (docStatus === 'finalized') {
          await supabase.from('tenants').update({ status: 'active' }).in('id', tenantIds)
        }
      }

      // Mettre à jour le statut du bien si c'est un bail
      const currentPropertyId = docState.property_id ?? doc?.property_id
      if (currentPropertyId && docState.type === 'lease') {
        const entryDate = (docState.content?.["Date d'entree"] || docState.content?.["Date d'entrée"]) as string | undefined
        const today = new Date().toISOString().split('T')[0]
        const propertyStatus = entryDate && entryDate <= today ? 'rented' : 'upcoming'
        await supabase.from('properties').update({ status: propertyStatus }).eq('id', currentPropertyId)
      }

      if (docState.tenant_signature) {
        await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docState.id }),
        })
      }
      setStep(3)
    }
    setLoading(false)
  }

  /* ── Step 3 : send signing link to tenant ────────────────── */
  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/documents/send-signing-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docState?.id }),
      })
      if (res.ok) {
        toast.success('Lien de signature envoyé au locataire')
        onSigned()
      } else {
        toast.error("Erreur lors de l'envoi")
      }
    } catch {
      toast.error("Erreur lors de l'envoi")
    }
    setSending(false)
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Fixed sub-header: status badge + step indicator */}
      <div className="flex-shrink-0 px-6 pt-3 pb-3 border-b bg-white">
        {docState && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-slate-500">{typeLabels[docState.type as keyof typeof typeLabels]}</span>
            <Badge variant={sc?.color ?? 'secondary'}>{sc?.label ?? docState.status}</Badge>
          </div>
        )}
        <StepIndicator current={step} />
      </div>

      {/* Step 1: wizard controls its own scroll/footer layout */}
      {step === 1 && (
        <div className="flex-1 overflow-hidden">
          <DocumentWizard
            doc={docState}
            onSave={handleSaveContent}
            onDocCreated={handleDocCreated}
            properties={properties}
            tenants={tenants}
            userId={userId}
          />
        </div>
      )}

      {/* Steps 2-3: scrollable content */}
      <div className={step !== 1 ? 'flex-1 overflow-y-auto px-6 py-4' : 'hidden'}>

      {/* ── STEP 2 : Signature ───────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Signature du bailleur</h3>
            {ownerSig && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </div>

          {ownerSig && !showCanvas && (
            <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
              <img src={ownerSig} alt="Signature bailleur" className="h-16 object-contain" />
            </div>
          )}

          {ownerSig && !showCanvas && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCanvas(true)}>
                Modifier la signature
              </Button>
              <Button
                size="sm"
                onClick={() => setStep(3)}
                className="text-[#063B26] font-semibold"
                style={{ backgroundColor: '#CFFF92' }}
              >
                Continuer →
              </Button>
            </div>
          )}

          {(!ownerSig || showCanvas) && (
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-2">Signez dans le cadre ci-dessous</p>
              <SignatureCanvas onSave={handleSaveSignature} existingSignature={ownerSig} />
              {loading && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
            </div>
          )}

          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Retour à la revue
          </button>
        </div>
      )}

      {/* ── STEP 3 : Send ────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Envoi au locataire</h3>

          {ownerSig && (
            <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50 mb-2">
              <p className="text-xs text-slate-500 mb-1">Signature enregistrée</p>
              <img src={ownerSig} alt="Signature bailleur" className="h-12 object-contain" />
            </div>
          )}

          {docState.status === 'pending_tenant_signature' ? (
            <div className="flex items-center gap-2 bg-purple-50 rounded-lg p-3 text-sm text-purple-700">
              <Clock className="h-4 w-4 text-purple-400 flex-shrink-0" />
              Lien de signature déjà envoyé — en attente de la signature du locataire
            </div>
          ) : docState.sent_at ? (
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
              Document déjà envoyé le{' '}
              {new Date(docState.sent_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
              Votre bail est signé. Envoyez le lien de signature au locataire.
            </div>
          )}

          <div className="flex gap-2">
            {docState.status !== 'pending_tenant_signature' && !docState.sent_at && (
              <Button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 text-[#063B26] font-semibold"
                style={{ backgroundColor: '#CFFF92' }}
              >
                {sending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Send className="h-4 w-4 mr-2" />
                }
                Envoyer le lien de signature
              </Button>
            )}
            <Button variant="outline" onClick={onSigned} className="flex-1">
              {docState.status === 'pending_tenant_signature' || docState.sent_at ? 'Fermer' : 'Plus tard'}
            </Button>
          </div>

          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Retour à la signature
          </button>
        </div>
      )}

      </div>{/* end scrollable content */}
    </div>
  )
}
