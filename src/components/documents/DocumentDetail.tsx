'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, ChevronLeft, Send, Clock } from 'lucide-react'
import SignatureCanvas from './SignatureCanvas'

const typeLabels = {
  lease: 'Contrat de bail',
  entry_inspection: "État des lieux d'entrée",
  exit_inspection: "État des lieux de sortie",
  inventory: 'Inventaire',
}

const statusConfig = {
  draft:     { label: 'Brouillon', color: 'secondary' as const },
  sent:      { label: 'Envoyé',    color: 'default' as const },
  signed:    { label: 'Signé',     color: 'default' as const },
  finalized: { label: 'Finalisé',  color: 'default' as const },
}

interface Props {
  document: any
  onSigned: () => void
}

function initialStep(doc: any): 1 | 2 | 3 {
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
export default function DocumentDetail({ document: doc, onSigned }: Props) {
  const supabase   = createClient()
  const [step, setStep]       = useState<1 | 2 | 3>(initialStep(doc))
  const [content, setContent] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(doc.content ?? {}).map(([k, v]) => [k, String(v)]))
  )
  const [ownerSig, setOwnerSig]     = useState<string | null>(doc.owner_signature)
  const [showCanvas, setShowCanvas] = useState(!doc.owner_signature)
  const [loading, setLoading]       = useState(false)
  const [sending, setSending]       = useState(false)

  const sc = statusConfig[doc.status as keyof typeof statusConfig]

  /* ── Step 1 : save content ───────────────────────────────── */
  const handleSaveContent = async () => {
    setLoading(true)
    const { error } = await supabase
      .from('documents')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', doc.id)

    if (error) {
      toast.error('Erreur lors de la sauvegarde')
    } else {
      toast.success('Informations mises à jour')
      setStep(2)
    }
    setLoading(false)
  }

  /* ── Step 2 : save owner signature ──────────────────────── */
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
      setShowCanvas(false)
      toast.success('Signature enregistrée')
      if (doc.tenant_signature) {
        await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: doc.id }),
        })
      }
      setStep(3)
    }
    setLoading(false)
  }

  /* ── Step 3 : send to tenant ─────────────────────────────── */
  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id, sendEmail: true }),
      })
      if (res.ok) {
        toast.success('Document envoyé au locataire')
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{typeLabels[doc.type as keyof typeof typeLabels]}</span>
        <Badge variant={sc?.color ?? 'secondary'}>{sc?.label ?? doc.status}</Badge>
      </div>

      <StepIndicator current={step} />

      {/* ── STEP 1 : Review & Edit ───────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Informations du document</h3>
          {Object.keys(content).length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Aucun champ à afficher.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(content).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">{key}</label>
                  <Input
                    value={value}
                    onChange={(e) => setContent(prev => ({ ...prev, [key]: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          )}
          <Button
            onClick={handleSaveContent}
            disabled={loading}
            className="w-full text-[#063B26] font-semibold"
            style={{ backgroundColor: '#CFFF92' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enregistrer les modifications
          </Button>
        </div>
      )}

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

          {doc.sent_at ? (
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
              Document déjà envoyé le{' '}
              {new Date(doc.sent_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
              Votre bail est signé. Souhaitez-vous l&apos;envoyer au locataire ?
            </div>
          )}

          <div className="flex gap-2">
            {!doc.sent_at && (
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
                Envoyer au locataire
              </Button>
            )}
            <Button variant="outline" onClick={onSigned} className="flex-1">
              {doc.sent_at ? 'Fermer' : 'Plus tard'}
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
    </div>
  )
}
