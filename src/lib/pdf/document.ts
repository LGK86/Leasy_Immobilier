import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface TenantEntry {
  name: string
  signature?: string | null
}

interface DocumentData {
  type: 'lease' | 'entry_inspection' | 'exit_inspection' | 'inventory'
  title: string
  ownerName: string
  ownerAddress: string
  tenants: TenantEntry[]
  propertyAddress: string
  propertyCity: string
  propertyPostalCode: string
  content: Record<string, unknown>
  ownerSignature?: string | null
  date?: string
}

const typeLabels = {
  lease: 'CONTRAT DE BAIL',
  entry_inspection: "ETAT DES LIEUX D'ENTREE",
  exit_inspection: "ETAT DES LIEUX DE SORTIE",
  inventory: 'INVENTAIRE DU MOBILIER',
}

const MONTHS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Internal content keys not meant for display
const INTERNAL_KEYS = new Set(['tenant_ids', 'tenant_signatures', '_tenant_ids'])

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
  page.drawText(`Date : ${formatDate(data.date)}`, {
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
  for (let i = 0; i < data.tenants.length; i++) {
    drawField(`Locataire ${i + 1}`, data.tenants[i].name)
  }
  y -= 10

  drawSection('Bien loue')
  drawField('Adresse', data.propertyAddress)
  drawField('Ville', `${data.propertyPostalCode} ${data.propertyCity}`)
  y -= 10

  // Content fields
  const contentEntries = Object.entries(data.content ?? {}).filter(([key]) => !INTERNAL_KEYS.has(key))
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

  // ── Signatures ─────────────────────────────────────────────────────────────
  y -= 20
  const tenants = data.tenants

  // Determine row count for space check
  // 1 tenant → 1 row (owner + tenant side by side)
  // 2+ tenants → 1 row for owner alone + ceil(tenants.length / 2) rows for tenants
  const sigRowHeight = 110 // label(20) + box(80) + gap(10)
  const rowCount = tenants.length <= 1
    ? 1
    : 1 + Math.ceil(tenants.length / 2)
  const neededSpace = 40 + rowCount * sigRowHeight

  if (y < neededSpace) {
    page = pdfDoc.addPage([595, 842])
    y = height - 60
  }

  drawSection('Signatures')
  y -= 10

  const col0 = margin
  const col1 = width / 2 + 20
  const boxW = 190
  const boxH = 80

  // Helper: draw one signature box at (bx, by) with a given label and optional sig data
  const drawSigBox = async (bx: number, by: number, label: string, sigDataUrl?: string | null) => {
    page.drawText(label, {
      x: bx, y: by + boxH + 4, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65),
    })
    page.drawRectangle({
      x: bx, y: by, width: boxW, height: boxH,
      borderColor: rgb(0.7, 0.75, 0.85), borderWidth: 1, color: rgb(0.97, 0.98, 1),
    })
    if (sigDataUrl) {
      const sigData = sigDataUrl.replace(/^data:image\/\w+;base64,/, '')
      const sigBytes = Buffer.from(sigData, 'base64')
      try {
        const sigImage = await pdfDoc.embedPng(sigBytes)
        const sigDims = sigImage.scale(0.3)
        page.drawImage(sigImage, {
          x: bx + 10, y: by + 10,
          width: Math.min(sigDims.width, boxW - 20),
          height: Math.min(sigDims.height, boxH - 20),
        })
      } catch { /* ignore embed error */ }
    } else {
      page.drawText('Non signe', {
        x: bx + 60, y: by + 35, size: 9,
        font: helvetica, color: rgb(0.7, 0.75, 0.8),
      })
    }
  }

  if (tenants.length <= 1) {
    // 2-column layout: owner left, tenant right
    const rowY = y - boxH
    await drawSigBox(col0, rowY, 'Signature du bailleur', data.ownerSignature)
    if (tenants.length === 1) {
      await drawSigBox(col1, rowY, `Signature de ${tenants[0].name}`, tenants[0].signature)
    }
    y = rowY - 20
  } else {
    // Row 0: owner (left), first tenant (right)
    let rowY = y - boxH
    await drawSigBox(col0, rowY, 'Signature du bailleur', data.ownerSignature)
    await drawSigBox(col1, rowY, `Signature de ${tenants[0].name}`, tenants[0].signature)
    y = rowY - sigRowHeight

    // Remaining tenants: 2 per row
    for (let i = 1; i < tenants.length; i += 2) {
      rowY = y - boxH
      await drawSigBox(col0, rowY, `Signature de ${tenants[i].name}`, tenants[i].signature)
      if (i + 1 < tenants.length) {
        await drawSigBox(col1, rowY, `Signature de ${tenants[i + 1].name}`, tenants[i + 1].signature)
      }
      y = rowY - sigRowHeight
    }
  }

  // Footer
  const pages = pdfDoc.getPages()
  for (const p of pages) {
    p.drawRectangle({ x: 0, y: 0, width, height: 35, color: rgb(0.96, 0.97, 0.99) })
    p.drawText('Document genere par Leasy Immobilier', {
      x: margin, y: 12, size: 8, font: helvetica, color: rgb(0.6, 0.65, 0.75),
    })
  }

  return pdfDoc.save()
}
