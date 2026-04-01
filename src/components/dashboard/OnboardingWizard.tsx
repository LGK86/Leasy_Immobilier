'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, PartyPopper, FileText } from 'lucide-react'
import PropertyForm from '@/components/properties/PropertyForm'
import TenantForm from '@/components/tenants/TenantForm'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  open: boolean
  onClose: () => void
  step: number | null | undefined
  userId: string
  initialProperties: { id: string; address: string; city: string }[]
  onStepComplete: (newStep: number) => void
}

const STEP_LABELS = [
  'Votre premier bien',
  'Votre premier locataire',
  'Votre premier bail',
]

export default function OnboardingWizard({
  open,
  onClose,
  step,
  userId,
  initialProperties,
  onStepComplete,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [properties, setProperties] = useState(initialProperties)

  useEffect(() => {
    setProperties(initialProperties)
  }, [initialProperties])

  const advanceStep = async (newStep: number) => {
    const updates: Record<string, unknown> = { onboarding_step: newStep }
    if (newStep >= 3) updates.onboarding_completed = true
    await supabase.from('profiles').update(updates).eq('id', userId)
    onStepComplete(newStep)
  }

  const handlePropertySuccess = async () => {
    // Refetch properties for the tenant form
    const { data } = await supabase
      .from('properties')
      .select('id, address, city')
      .eq('owner_id', userId)
    setProperties(data ?? [])
    await advanceStep(1)
    router.refresh()
  }

  const handleTenantSuccess = async () => {
    await advanceStep(2)
    router.refresh()
  }

  const handleBailDone = async () => {
    await advanceStep(3)
  }

  const handleGoToDocuments = async () => {
    await advanceStep(3)
    onClose()
    router.push('/documents')
  }

  const handleFinish = () => {
    onClose()
    router.refresh()
  }

  const safeStep = typeof step === 'number' && step >= 0 ? step : 0
  const displayStep = Math.min(safeStep, 3)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="p-0 gap-0"
        style={{
          width: '90vw',
          height: '90vh',
          maxWidth: '90vw',
          maxHeight: '90vh',
          minWidth: '90vw',
          minHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-8 py-5 border-b"
          style={{ backgroundColor: '#063B26' }}
        >
          <DialogTitle className="text-base font-semibold" style={{ color: '#CFFF92' }}>
            {displayStep < 3
              ? `Étape ${displayStep + 1}/3 — ${STEP_LABELS[displayStep]}`
              : 'Configuration terminée !'}
          </DialogTitle>
          {displayStep < 3 && (
            <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{ width: `${Math.round(((displayStep + 1) / 3) * 100)}%`, backgroundColor: '#CFFF92' }}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 0 — Create property */}
          {displayStep === 0 && (
            <div className="max-w-lg mx-auto px-8 py-8">
              <p className="text-slate-500 mb-6 text-sm">
                Commençons par renseigner votre premier bien immobilier.
              </p>
              <PropertyForm
                property={null}
                userId={userId}
                onSuccess={handlePropertySuccess}
              />
            </div>
          )}

          {/* Step 1 — Create tenant */}
          {displayStep === 1 && (
            <div className="max-w-lg mx-auto px-8 py-8">
              <p className="text-slate-500 mb-6 text-sm">
                Ajoutez maintenant votre premier locataire et associez-le au bien créé.
              </p>
              <TenantForm
                tenant={null}
                properties={properties}
                userId={userId}
                onSuccess={handleTenantSuccess}
              />
            </div>
          )}

          {/* Step 2 — Create lease CTA */}
          {displayStep === 2 && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: '#f0fdf4' }}>
                <FileText className="h-8 w-8" style={{ color: '#063B26' }} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">
                Dernière étape : votre contrat de bail
              </h3>
              <p className="text-slate-500 max-w-md mb-8">
                Créez maintenant le contrat de bail pour votre locataire. Vous pourrez le compléter,
                le faire signer et l&apos;envoyer directement depuis l&apos;application.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleBailDone}
                  className="text-slate-600"
                >
                  Je le ferai plus tard
                </Button>
                <Button
                  onClick={handleGoToDocuments}
                  className="font-semibold text-[#063B26]"
                  style={{ backgroundColor: '#CFFF92' }}
                >
                  Créer mon bail maintenant →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Congratulations */}
          {displayStep >= 3 && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: '#f0fdf4' }}>
                <PartyPopper className="h-10 w-10" style={{ color: '#063B26' }} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">
                Félicitations !
              </h3>
              <p className="text-slate-500 max-w-md mb-2">
                Votre espace Leasy est prêt. Vous pouvez maintenant gérer vos biens, vos locataires et vos paiements depuis le tableau de bord.
              </p>
              <div className="flex items-center gap-2 text-sm mb-8" style={{ color: '#063B26' }}>
                <CheckCircle2 className="h-4 w-4" />
                <span>Configuration complète</span>
              </div>
              <Button
                onClick={handleFinish}
                className="font-semibold text-[#063B26] px-8"
                style={{ backgroundColor: '#CFFF92' }}
              >
                Accéder au tableau de bord
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
