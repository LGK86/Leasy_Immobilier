'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import OnboardingBanner from './OnboardingBanner'
import OnboardingWizard from './OnboardingWizard'

interface Props {
  initialStep: number | null | undefined
  userId: string
  initialProperties: { id: string; address: string; city: string }[]
}

export default function OnboardingContainer({ initialStep, userId, initialProperties }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<number>(
    typeof initialStep === 'number' && initialStep >= 0 ? initialStep : 0
  )
  const [showWizard, setShowWizard] = useState(false)
  // Incrémenté au redémarrage pour forcer un remontage du wizard (état interne réinitialisé)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if ((initialStep ?? 0) < 3 && !sessionStorage.getItem('leasy_onboarding_shown')) {
      sessionStorage.setItem('leasy_onboarding_shown', '1')
      setShowWizard(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenWizard = async () => {
    if (step >= 3) {
      // "Revoir le guide" : réinitialiser l'étape en BDD et localement
      await supabase
        .from('profiles')
        .update({ onboarding_step: 0, onboarding_completed: false })
        .eq('id', userId)
      setStep(0)
      setResetKey(k => k + 1) // force le remontage du wizard avec un état vierge
    }
    setShowWizard(true)
  }

  return (
    <>
      <OnboardingBanner step={step} onOpen={handleOpenWizard} />
      <OnboardingWizard
        key={resetKey}
        open={showWizard}
        onClose={() => setShowWizard(false)}
        step={step}
        userId={userId}
        initialProperties={initialProperties}
        onStepComplete={(newStep) => setStep(newStep)}
      />
    </>
  )
}
