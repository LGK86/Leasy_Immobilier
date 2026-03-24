'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SignatureCanvas from '@/components/documents/SignatureCanvas'
import { Building2, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  doc: any
  token: string
}

export default function SignPage({ doc, token }: Props) {
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSign = async (sigDataUrl: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/documents/tenant-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signature: sigDataUrl }),
      })
      if (res.ok) {
        setSigned(true)
        toast.success('Document signé avec succès !')
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Erreur lors de la signature')
      }
    } catch {
      toast.error('Erreur lors de la signature')
    }
    setLoading(false)
  }

  const tenantName = doc.tenant
    ? `${doc.tenant.first_name} ${doc.tenant.last_name}`
    : 'Locataire'
  const propertyAddress = doc.property
    ? `${doc.property.address}, ${doc.property.city}`
    : ''

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F4] p-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-100 p-4 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Document signé !</h1>
          <p className="text-slate-500">
            Votre signature a bien été enregistrée. Les deux parties recevront une copie du document signé.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F4] p-4 flex flex-col items-center">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex justify-center my-8">
          <div className="flex items-center gap-2">
            <div className="bg-[#CFFF92] p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-[#063B26]" />
            </div>
            <span className="text-2xl font-bold text-[#063B26]">Leasy Immobilier</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{doc.title}</CardTitle>
            {propertyAddress && (
              <p className="text-sm text-slate-500">{propertyAddress}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
              <p>Bonjour <strong>{tenantName}</strong>,</p>
              <p className="mt-1">Votre bailleur vous invite à signer ce document. Veuillez apposer votre signature ci-dessous.</p>
            </div>

            {/* Owner signature preview */}
            {doc.owner_signature && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Signature du bailleur</p>
                <div className="border border-emerald-200 rounded-lg p-2 bg-emerald-50">
                  <img src={doc.owner_signature} alt="Signature bailleur" className="h-12 object-contain" />
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Votre signature</p>
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Signez dans le cadre ci-dessous</p>
                <SignatureCanvas onSave={handleSign} />
                {loading && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              En signant, vous acceptez les termes du document ci-dessus.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
