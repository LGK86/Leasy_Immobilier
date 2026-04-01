'use client'

import { useState, useEffect } from 'react'
import OnboardingBanner from './OnboardingBanner'
import OnboardingWizard from './OnboardingWizard'

interface Props {
  initialStep: number | null | undefined
  userId: string
  initialProperties: { id: string; address: string; city: string }[]
}

export default function OnboardingContainer({ initialStep, userId, initialProperties }: Props) {
  const [step, setStep] = useState<number>(
    typeof initialStep === 'number' && initialStep >= 0 ? initialStep : 0
  )
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if ((initialStep ?? 0) < 3 && !sessionStorage.getItem('leasy_onboarding_shown')) {
      sessionStorage.setItem('leasy_onboarding_shown', '1')
      setShowWizard(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (step >= 3) return null

  return (
    <>
      <OnboardingBanner step={step} onOpen={() => setShowWizard(true)} />
      <OnboardingWizard
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
