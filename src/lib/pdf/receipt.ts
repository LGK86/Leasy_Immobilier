import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// ASCII-only month names — avoids accented chars issues in WinAnsiEncoding
const MONTHS_FR = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
]

// Safe number formatter: avoids \u202F (NARROW NO-BREAK SPACE) produced by
// toLocaleString('fr-FR') on Node 18+, which is NOT in WinAnsiEncoding
// and causes pdf-lib to throw an encoding error.
const fmt = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' EUR'

// Safe date formatter — avoids locale-dependent output from toLocaleDateString
const formatDate = (iso: string) => {
  const [year, month, day] = iso.split('-')
  return `${parseInt(day)} ${MONTHS_FR[parseInt(month) - 1]} ${year}`
}

interface ReceiptData {
  ownerFirstName: string
  ownerLastName: string
  ownerAddress: string
  ownerCity: string
  ownerPostalCode: string
  tenantFirstName: string
  tenantLastName: string
  propertyAddress: string
  propertyCity: string
  propertyPostalCode: string
  rent: number
  charges: number
  periodMonth: number
  periodYear: number
  issueDate: string
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 60

  // Header background
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: rgb(0.02, 0.23, 0.15), // leasy-sidebar #063B26
  })

  // Title
  page.drawText('QUITTANCE DE LOYER', {
    x: margin,
    y: height - 50,
    size: 22,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  const monthName = MONTHS_FR[data.periodMonth - 1] ?? String(data.periodMonth)
  page.drawText(`Periode : ${monthName} ${data.periodYear}`, {
    x: margin,
    y: height - 80,
    size: 12,
    font: helvetica,
    color: rgb(0.9, 0.95, 1),
  })

  let y = height - 150

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: width - margin, y: yPos },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92),
    })
  }

  // Section: Bailleur
  page.drawText('BAILLEUR', { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65) })
  y -= 20
  page.drawText(`${data.ownerFirstName} ${data.ownerLastName}`, { x: margin, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.15, 0.25) })
  y -= 18
  if (data.ownerAddress) {
    page.drawText(data.ownerAddress, { x: margin, y, size: 11, font: helvetica, color: rgb(0.3, 0.35, 0.45) })
    y -= 16
  }
  if (data.ownerPostalCode || data.ownerCity) {
    page.drawText(`${data.ownerPostalCode} ${data.ownerCity}`.trim(), { x: margin, y, size: 11, font: helvetica, color: rgb(0.3, 0.35, 0.45) })
  }

  y -= 30
  drawLine(y)
  y -= 25

  // Section: Locataire
  page.drawText('LOCATAIRE', { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65) })
  y -= 20
  page.drawText(`${data.tenantFirstName} ${data.tenantLastName}`, { x: margin, y, size: 13, font: helveticaBold, color: rgb(0.1, 0.15, 0.25) })

  y -= 30
  drawLine(y)
  y -= 25

  // Section: Bien loue
  page.drawText('BIEN LOUE', { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65) })
  y -= 20
  page.drawText(data.propertyAddress, { x: margin, y, size: 12, font: helvetica, color: rgb(0.1, 0.15, 0.25) })
  y -= 16
  page.drawText(`${data.propertyPostalCode} ${data.propertyCity}`, { x: margin, y, size: 12, font: helvetica, color: rgb(0.3, 0.35, 0.45) })

  y -= 30
  drawLine(y)
  y -= 25

  // Section: Detail du paiement
  page.drawText('DETAIL DU PAIEMENT', { x: margin, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.5, 0.65) })
  y -= 25

  const drawRow = (label: string, amount: string, bold = false) => {
    page.drawText(label, {
      x: margin, y, size: 12,
      font: bold ? helveticaBold : helvetica,
      color: rgb(0.15, 0.2, 0.3),
    })
    page.drawText(amount, {
      x: width - margin - 100, y, size: 12,
      font: bold ? helveticaBold : helvetica,
      color: bold ? rgb(0.02, 0.23, 0.15) : rgb(0.15, 0.2, 0.3),
    })
    y -= 22
  }

  drawRow('Loyer hors charges', fmt(data.rent))
  drawRow('Charges locatives', fmt(data.charges))

  y -= 5
  drawLine(y)
  y -= 22
  drawRow('TOTAL', fmt(data.rent + data.charges), true)

  y -= 30
  drawLine(y)
  y -= 30

  // Certification text (ASCII-safe French — no accented chars to avoid any edge case)
  const total = fmt(data.rent + data.charges)
  const certText = `Je soussigne(e) ${data.ownerFirstName} ${data.ownerLastName}, proprietaire du logement designe ci-dessus, donne quittance a ${data.tenantFirstName} ${data.tenantLastName} pour le paiement de la somme de ${total} au titre du loyer et des charges du mois de ${monthName} ${data.periodYear}.`

  const words = certText.split(' ')
  let line = ''
  const maxWidth = width - 2 * margin
  const fontSize = 10

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word
    const textWidth = helvetica.widthOfTextAtSize(testLine, fontSize)
    if (textWidth > maxWidth && line) {
      page.drawText(line, { x: margin, y, size: fontSize, font: helvetica, color: rgb(0.2, 0.25, 0.35) })
      y -= 15
      line = word
    } else {
      line = testLine
    }
  }
  if (line) {
    page.drawText(line, { x: margin, y, size: fontSize, font: helvetica, color: rgb(0.2, 0.25, 0.35) })
    y -= 15
  }

  y -= 30

  // Issue date
  page.drawText(`Emise le ${formatDate(data.issueDate)}`, {
    x: margin, y, size: 10,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.65),
  })

  // Footer
  page.drawRectangle({ x: 0, y: 0, width, height: 35, color: rgb(0.96, 0.97, 0.99) })
  page.drawText('Document genere par Leasy Immobilier', {
    x: margin, y: 12, size: 8,
    font: helvetica,
    color: rgb(0.6, 0.65, 0.75),
  })

  return pdfDoc.save()
}
