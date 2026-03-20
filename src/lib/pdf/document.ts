import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface DocumentData {
  type: 'lease' | 'entry_inspection' | 'exit_inspection' | 'inventory'
  title: string
  ownerName: string
  ownerAddress: string
  tenantName: string
  propertyAddress: string
  propertyCity: string
  propertyPostalCode: string
  content: Record<string, unknown>
  ownerSignature?: string | null
  tenantSignature?: string | null
  date?: string
}

const typeLabels = {
  lease: 'CONTRAT DE BAIL',
  entry_inspection: "ÉTAT DES LIEUX D'ENTRÉE",
  exit_inspection: "ÉTAT DES LIEUX DE SORTIE",
  inventory: 'INVENTAIRE DU MOBILIER',
}

export async function generateDocumentPDF(data: DocumentData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([595, 842])
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const margin = 60
  let y = height - 60

  // Header
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(0.1, 0.37, 0.87) })
  page.drawText(typeLabels[data.type] ?? data.title, {
    x: margin, y: height - 45, size: 18, font: helveticaBold, color: rgb(1, 1, 1),
  })

  const dateStr = data.date
    ? new Date(data.date).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')
  page.drawText(`Date : ${dateStr}`, {
    x: margin, y: height - 68, size: 10, font: helvetica, color: rgb(0.85, 0.9, 1),
  })

  y = height - 120

  const drawSection = (title: string) => {
    page.drawText(title.toUpperCase(), {
      x: margin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65),
    })
    y -= 5
    page.drawLine({
      start: { x: margin, y }, end: { x: width - margin, y },
      thickness: 1, color: rgb(0.85, 0.88, 0.92),
    })
    y -= 18
  }

  const drawField = (label: string, value: string) => {
    page.drawText(`${label} :`, { x: margin, y, size: 10, font: helveticaBold, color: rgb(0.3, 0.35, 0.45) })
    page.drawText(value || '—', { x: margin + 120, y, size: 10, font: helvetica, color: rgb(0.1, 0.15, 0.25) })
    y -= 18
  }

  // Parties
  drawSection('Parties')
  drawField('Bailleur', data.ownerName)
  drawField('Adresse bailleur', data.ownerAddress)
  drawField('Locataire', data.tenantName)
  y -= 10

  drawSection('Bien loué')
  drawField('Adresse', data.propertyAddress)
  drawField('Ville', `${data.propertyPostalCode} ${data.propertyCity}`)
  y -= 10

  // Content fields
  const contentEntries = Object.entries(data.content ?? {})
  if (contentEntries.length > 0) {
    drawSection('Informations')
    for (const [key, val] of contentEntries) {
      if (y < 100) {
        page = pdfDoc.addPage([595, 842])
        y = height - 60
      }
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      drawField(label, String(val ?? ''))
    }
  }

  // Signatures
  y -= 20
  if (y < 200) {
    page = pdfDoc.addPage([595, 842])
    y = height - 60
  }

  drawSection('Signatures')
  y -= 10

  const signatureBoxY = y - 80
  const ownerBoxX = margin
  const tenantBoxX = width / 2 + 20

  // Owner signature box
  page.drawText('Signature du bailleur', {
    x: ownerBoxX, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65),
  })
  page.drawRectangle({
    x: ownerBoxX, y: signatureBoxY, width: 190, height: 80,
    borderColor: rgb(0.7, 0.75, 0.85), borderWidth: 1, color: rgb(0.97, 0.98, 1),
  })

  if (data.ownerSignature) {
    // Decode base64 signature image
    const sigData = data.ownerSignature.replace(/^data:image\/\w+;base64,/, '')
    const sigBytes = Buffer.from(sigData, 'base64')
    try {
      const sigImage = await pdfDoc.embedPng(sigBytes)
      const sigDims = sigImage.scale(0.3)
      page.drawImage(sigImage, {
        x: ownerBoxX + 10,
        y: signatureBoxY + 10,
        width: Math.min(sigDims.width, 170),
        height: Math.min(sigDims.height, 60),
      })
    } catch { /* ignore signature embed error */ }
  } else {
    page.drawText('Non signé', {
      x: ownerBoxX + 60, y: signatureBoxY + 35, size: 9,
      font: helvetica, color: rgb(0.7, 0.75, 0.8),
    })
  }

  // Tenant signature box
  page.drawText('Signature du locataire', {
    x: tenantBoxX, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65),
  })
  page.drawRectangle({
    x: tenantBoxX, y: signatureBoxY, width: 190, height: 80,
    borderColor: rgb(0.7, 0.75, 0.85), borderWidth: 1, color: rgb(0.97, 0.98, 1),
  })

  if (data.tenantSignature) {
    const sigData = data.tenantSignature.replace(/^data:image\/\w+;base64,/, '')
    const sigBytes = Buffer.from(sigData, 'base64')
    try {
      const sigImage = await pdfDoc.embedPng(sigBytes)
      const sigDims = sigImage.scale(0.3)
      page.drawImage(sigImage, {
        x: tenantBoxX + 10,
        y: signatureBoxY + 10,
        width: Math.min(sigDims.width, 170),
        height: Math.min(sigDims.height, 60),
      })
    } catch { /* ignore */ }
  } else {
    page.drawText('Non signé', {
      x: tenantBoxX + 60, y: signatureBoxY + 35, size: 9,
      font: helvetica, color: rgb(0.7, 0.75, 0.8),
    })
  }

  // Footer
  const pages = pdfDoc.getPages()
  for (const p of pages) {
    p.drawRectangle({ x: 0, y: 0, width, height: 35, color: rgb(0.96, 0.97, 0.99) })
    p.drawText('Document généré par Leasy Immobilier', {
      x: margin, y: 12, size: 8, font: helvetica, color: rgb(0.6, 0.65, 0.75),
    })
  }

  return pdfDoc.save()
}
