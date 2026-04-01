'use client'

import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STEPS = [
  'Ajouter un bien',
  'Ajouter un locataire',
  'Créer un bail',
]

interface Props {
  step: number | null | undefined
  onOpen: () => void
}

export default function OnboardingBanner({ step, onOpen }: Props) {
  const safeStep = typeof step === 'number' && step >= 0 ? step : 0
  if (safeStep >= 3) return null

  const progress = Math.round((safeStep / 3) * 100)

  return (
    <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#063B26' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base mb-1" style={{ color: '#CFFF92' }}>
            Bienvenue sur Leasy ! Configurez votre espace en 3 étapes
          </h2>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: '#CFFF92' }}
              />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {safeStep}/3
            </span>
          </div>
          <div className="flex gap-6 flex-wrap">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                {i < safeStep
                  ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: '#CFFF92' }} />
                  : <Circle className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                }
                <span style={{ color: i < safeStep ? 'rgba(255,255,255,0.5)' : 'white', textDecoration: i < safeStep ? 'line-through' : 'none' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <Button
          onClick={onOpen}
          className="flex-shrink-0 font-semibold text-[#063B26] hover:opacity-90"
          style={{ backgroundColor: '#CFFF92' }}
        >
          Continuer
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
