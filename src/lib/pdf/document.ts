import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

// ── Types ───────────────────────────────────────────────────────────────────

interface TenantEntry {
  name: string
  email?: string
  phone?: string
  signature?: string | null
}

export interface DocumentData {
  type: 'lease' | 'entry_inspection' | 'exit_inspection' | 'inventory'
  title: string
  ownerName: string
  ownerAddress: string
  ownerEmail?: string
  ownerPhone?: string
  tenants: TenantEntry[]
  propertyAddress: string
  propertyCity: string
  propertyPostalCode: string
  propertyType?: string
  content: Record<string, unknown>
  ownerSignature?: string | null
  date?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const COL_GREEN  = rgb(0.024, 0.231, 0.149)   // #063B26
const COL_ACCENT = rgb(0.812, 1.0,   0.573)   // #CFFF92
const COL_WHITE  = rgb(1, 1, 1)
const COL_DARK   = rgb(0.12, 0.16, 0.22)
const COL_MID    = rgb(0.35, 0.40, 0.48)
const COL_LIGHT  = rgb(0.62, 0.66, 0.74)
const COL_LINE   = rgb(0.88, 0.90, 0.93)

const MONTHS = [
  'janvier','fevrier','mars','avril','mai','juin',
  'juillet','aout','septembre','octobre','novembre','decembre',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip accents and non-WinAnsiEncoding chars */
function sa(s: string): string {
  if (!s) return ''
  return s
    .replace(/[éèêëẽ]/g,'e').replace(/[àâäã]/g,'a').replace(/[ùûüũ]/g,'u')
    .replace(/[îï]/g,'i').replace(/[ôõö]/g,'o').replace(/ç/g,'c')
    .replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/ñ/g,'n')
    .replace(/[ÉÈÊË]/g,'E').replace(/[ÀÂÄ]/g,'A').replace(/[ÙÛÜ]/g,'U')
    .replace(/[ÎÏ]/g,'I').replace(/[ÔÖ]/g,'O').replace(/Ç/g,'C')
    .replace(/Œ/g,'OE').replace(/Æ/g,'AE')
    .replace(/[«»]/g,'"').replace(/[\u2018\u2019\u02BC]/g,"'")
    .replace(/[\u2013\u2014]/g,'-').replace(/\u2026/g,'...')
    .replace(/\u00A0/g,' ')
}

function formatDateDMY(dateStr?: string): string {
  if (!dateStr) return '_______________'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return sa(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '_______________'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return sa(dateStr)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function fmtAmt(val: unknown): string {
  const n = parseFloat(String(val ?? '0'))
  if (isNaN(n) || n === 0) return '—'
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')
}

function cnt(content: Record<string, unknown>, key: string, fallback = ''): string {
  return sa(String(content[key] ?? fallback))
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue }
    const words = para.split(' ')
    let cur = ''
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur); cur = word
      } else { cur = test }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function generateDocumentPDF(data: DocumentData): Promise<Uint8Array> {
  if (data.type === 'lease') return generateLeasePDF(data)
  if (data.type === 'entry_inspection' || data.type === 'exit_inspection') return generateInspectionPDF(data)
  if (data.type === 'inventory') return generateInventoryPDF(data)
  return generateInspectionPDF(data) // fallback
}

// ── Bail meublé ALUR ─────────────────────────────────────────────────────────

async function generateLeasePDF(data: DocumentData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const HLV  = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const HLVB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const W = 595, H = 842, M = 55, CW = W - M * 2, FOOTER_H = 28

  let page: PDFPage = null!
  let y = 0
  let pageNum = 0

  // ── Page management ────────────────────────────────────────────────────────

  const addFooter = () => {
    if (!page) return
    page.drawRectangle({ x: 0, y: 0, width: W, height: FOOTER_H, color: rgb(0.97, 0.97, 0.97) })
    page.drawLine({ start: { x: 0, y: FOOTER_H }, end: { x: W, y: FOOTER_H }, thickness: 0.5, color: COL_LINE })
    page.drawText('Document genere par Leasy Immobilier', {
      x: M, y: 9, size: 7, font: HLV, color: COL_LIGHT,
    })
    page.drawText(`Page ${pageNum}`, {
      x: W - M - 25, y: 9, size: 7, font: HLV, color: COL_LIGHT,
    })
  }

  const newPage = () => {
    addFooter()
    page = pdfDoc.addPage([W, H])
    pageNum++
    y = H - M
  }

  const checkY = (needed: number) => {
    if (y < FOOTER_H + needed + 20) newPage()
  }

  // ── Drawing helpers ────────────────────────────────────────────────────────

  const drawWrapped = (
    text: string, xOff: number, size: number,
    font: PDFFont, color: ReturnType<typeof rgb>, maxW?: number
  ) => {
    const lines = wrapLines(sa(text), font, size, (maxW ?? CW) - xOff)
    const lh = size + 4
    for (const line of lines) {
      if (!line) { y -= Math.floor(lh * 0.4); continue }
      checkY(lh + 10)
      page.drawText(line, { x: M + xOff, y, size, font, color })
      y -= lh
    }
  }

  const sectionTitle = (num: string, title: string) => {
    checkY(32)
    y -= 8
    page.drawRectangle({ x: M - 4, y: y - 5, width: CW + 8, height: 21, color: COL_GREEN })
    const label = num ? `${num} — ${sa(title)}` : sa(title)
    page.drawText(label, { x: M + 2, y: y + 2, size: 9, font: HLVB, color: COL_WHITE })
    y -= 24
  }

  const subSection = (title: string) => {
    checkY(22)
    y -= 5
    page.drawText(sa(title).toUpperCase(), { x: M, y, size: 8, font: HLVB, color: COL_MID })
    y -= 3
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: COL_LINE })
    y -= 13
  }

  const field = (label: string, value: string) => {
    checkY(16)
    page.drawText(`${sa(label)} :`, { x: M, y, size: 9, font: HLVB, color: COL_MID })
    page.drawText(sa(value) || '—', { x: M + 145, y, size: 9, font: HLV, color: COL_DARK })
    y -= 14
  }

  const paragraph = (text: string, indent = 0) => {
    y -= 3
    drawWrapped(text, indent, 8.5, HLV, COL_DARK)
    y -= 4
  }

  const bullet = (text: string) => {
    checkY(14)
    page.drawText('•', { x: M + 6, y, size: 9, font: HLVB, color: COL_GREEN })
    drawWrapped(text, 18, 9, HLV, COL_DARK, CW - 18)
  }

  const c = (key: string, fb = '') => cnt(data.content, key, fb)

  // ── PAGE 1 — HEADER ────────────────────────────────────────────────────────

  newPage()

  const HDR = 112
  page.drawRectangle({ x: 0, y: H - HDR, width: W, height: HDR, color: COL_GREEN })
  page.drawRectangle({ x: 0, y: H - HDR - 4, width: W, height: 4, color: COL_ACCENT })

  page.drawText('Leasy Immobilier', {
    x: M, y: H - 42, size: 22, font: HLVB, color: COL_ACCENT,
  })
  page.drawText('Contrat de location de logement meuble', {
    x: M, y: H - 65, size: 13, font: HLVB, color: COL_WHITE,
  })
  page.drawText('Soumis au titre du 1er bis de la loi n 89-462 du 6 juillet 1989', {
    x: M, y: H - 83, size: 8, font: HLV, color: rgb(0.72, 0.88, 0.78),
  })
  page.drawText(`Etabli le ${formatDate(data.date)}`, {
    x: M, y: H - 97, size: 8, font: HLV, color: rgb(0.72, 0.88, 0.78),
  })

  y = H - HDR - 18

  // ── SECTION I — DESIGNATION DES PARTIES ────────────────────────────────────

  sectionTitle('I', 'DESIGNATION DES PARTIES')

  subSection('Le Bailleur')
  field('Nom et prenom', data.ownerName)
  field('Domicile', data.ownerAddress)
  field('Qualite', 'Personne physique')
  if (data.ownerEmail) field('Email', data.ownerEmail)
  if (data.ownerPhone) field('Telephone', data.ownerPhone)
  y -= 4

  subSection(data.tenants.length > 1 ? 'Les Locataires' : 'Le Locataire')
  for (let i = 0; i < data.tenants.length; i++) {
    const t = data.tenants[i]
    if (data.tenants.length > 1) {
      checkY(14)
      page.drawText(`Locataire ${i + 1} :`, { x: M, y, size: 9, font: HLVB, color: COL_MID })
      y -= 13
    }
    field('Nom et prenom', t.name)
    if (t.email) field('Email', t.email)
    if (t.phone) field('Telephone', t.phone)
    if (i < data.tenants.length - 1) y -= 6
  }
  y -= 6

  // ── SECTION II — OBJET DU CONTRAT ──────────────────────────────────────────

  sectionTitle('II', 'OBJET DU CONTRAT')

  subSection('Localisation du logement')
  field('Adresse', `${data.propertyAddress}, ${data.propertyPostalCode} ${sa(data.propertyCity)}`)
  field('Destination', "Usage exclusif d'habitation principale")
  y -= 4

  subSection('Description du logement')
  field('Type d habitat', c("Type d habitat", 'Immeuble collectif'))
  field('Regime juridique', c('Regime', 'Copropriete'))
  field('Periode de construction', c('Periode de construction'))
  field('Surface habitable', c('Surface habitable') ? `${c('Surface habitable')} m2` : '—')
  field('Nombre de pieces', c('Nombre de pieces'))
  y -= 4

  subSection('Equipements et services')
  field('Locaux privatifs', c('Locaux privatifs', 'Logement complet'))
  field('Parties communes', c('Parties communes', 'Hall, escaliers'))
  if (c('Autres parties')) field('Autres parties', c('Autres parties'))
  if (c('Equipements'))    field('Equipements', c('Equipements'))
  field('Chauffage', c('Chauffage', 'Individuel'))
  field('Eau chaude', c('Eau chaude', 'Individuelle'))
  if (c('Internet'))       field('Acces internet', c('Internet'))
  y -= 6

  // ── SECTION III — DATE DE PRISE D'EFFET ET DUREE ───────────────────────────

  sectionTitle('III', "DATE DE PRISE D'EFFET ET DUREE")

  const startDateRaw = c("Date d'entree")
  const durationMonths = c('Duree du bail (mois)', '12')

  field("Date de prise d'effet", formatDate(startDateRaw))
  field('Duree du contrat', durationMonths ? `${durationMonths} mois` : '1 an (location meublee)')
  paragraph("Conformement a l'article 11 de la loi du 6 juillet 1989, le contrat est conclu pour une duree d'un an minimum. A son expiration, il est reconduit tacitement pour la meme duree, sauf conge delivre dans les conditions legales.")
  y -= 4

  // ── SECTION IV — CONDITIONS FINANCIERES ────────────────────────────────────

  sectionTitle('IV', 'CONDITIONS FINANCIERES')

  const rentRaw    = c('Loyer mensuel (€)')
  const chargesRaw = c('Charges (€)')
  const depositRaw = c('Depot de garantie (€)')
  const rentAmt    = parseFloat(rentRaw) || 0
  const chargesAmt = parseFloat(chargesRaw) || 0
  const depositAmt = parseFloat(depositRaw) || 0

  subSection('Loyer')
  field('Loyer mensuel hors charges', rentAmt ? `${fmtAmt(rentAmt)} EUR` : '_____ EUR')
  checkY(16)
  page.drawText(sa(`Soumis au decret d encadrement des loyers : NON`), { x: M, y, size: 9, font: HLVB, color: COL_MID })
  y -= 14
  y -= 4

  subSection('Charges recuperables')
  field('Montant mensuel', chargesAmt ? `${fmtAmt(chargesAmt)} EUR` : '_____ EUR')
  field('Modalite', 'Provisions mensuelles avec regularisation annuelle')
  if (rentAmt && chargesAmt) {
    field('Total mensuel (loyer + charges)', `${fmtAmt(rentAmt + chargesAmt)} EUR`)
  }
  y -= 4

  subSection('Modalites de paiement')
  paragraph("Le loyer est payable le 5 de chaque mois, a terme echu, par tout moyen convenu entre les parties.")
  y -= 4

  subSection('Depot de garantie')
  field('Montant', depositAmt ? `${fmtAmt(depositAmt)} EUR` : '_____ EUR')
  paragraph("Conformement a l'article 22 de la loi du 6 juillet 1989, le depot de garantie ne peut exceder un mois de loyer hors charges. Il sera restitue dans un delai d'un mois a compter de la remise des cles si l'etat des lieux de sortie est conforme, ou deux mois en cas de degradations constatees.")
  y -= 4

  // ── SECTION V — TRAVAUX ────────────────────────────────────────────────────

  checkY(70)
  sectionTitle('V', 'TRAVAUX')
  paragraph("Le bailleur remet au locataire un logement en bon etat d'usage et de reparation ainsi que les equipements mentionnes au contrat en bon etat de fonctionnement. Les grosses reparations (art. 606 Code civil) sont a la charge du bailleur. Les reparations locatives et l'entretien courant sont a la charge du locataire conformement aux articles 7 et 7e de la loi du 6 juillet 1989.")
  y -= 4

  // ── SECTION VI — GARANTIES ─────────────────────────────────────────────────

  checkY(70)
  sectionTitle('VI', 'GARANTIES')
  field('Depot de garantie verse', depositAmt ? `${fmtAmt(depositAmt)} EUR` : '_____ EUR')
  paragraph("Le depot de garantie est verse par le locataire a la signature du contrat. En cas de non-paiement des loyers ou charges, ou en cas de degradations imputables au locataire, le bailleur pourra retenir tout ou partie du depot de garantie, apres justification, dans les delais prevus par la loi.")
  y -= 4

  // ── SECTION VII — CLAUSE DE SOLIDARITE ─────────────────────────────────────

  if (data.tenants.length > 1) {
    checkY(70)
    sectionTitle('VII', 'CLAUSE DE SOLIDARITE')
    const tenantNames = data.tenants.map(t => sa(t.name)).join(', ')
    paragraph(`En cas de pluralite de locataires (${tenantNames}), ceux-ci sont tenus solidairement et indivisiblement de toutes les obligations resultant du present contrat, notamment le paiement du loyer et des charges, et la reparation des degradations. Cette solidarite s'applique jusqu'a la restitution des cles et la signature de l'etat des lieux de sortie.`)
    y -= 4
  }

  // ── SECTION VIII — CLAUSE RESOLUTOIRE ──────────────────────────────────────

  checkY(80)
  sectionTitle('VIII', 'CLAUSE RESOLUTOIRE')
  paragraph("Conformement a l'article 24 de la loi du 6 juillet 1989, le contrat sera resilie de plein droit, apres decision de justice, a defaut de paiement du loyer et des charges aux termes convenus, deux mois apres un commandement de payer demeure infructueux. La clause resolutoire s'applique egalement en cas de :")
  bullet("Non-versement du depot de garantie a la signature du contrat")
  bullet("Absence de souscription d'une assurance contre les risques locatifs")
  bullet("Troubles de voisinage graves et repetes constates par decision de justice")
  y -= 4

  // ── SECTION IX — CONDITIONS PARTICULIERES ──────────────────────────────────

  checkY(60)
  sectionTitle('IX', 'CONDITIONS PARTICULIERES')
  const specialCond = c('Conditions particulieres')
  paragraph(specialCond || 'Neant.')
  y -= 4

  // ── SECTION X — ANNEXES OBLIGATOIRES ───────────────────────────────────────

  checkY(100)
  sectionTitle('X', 'ANNEXES OBLIGATOIRES')
  paragraph("Les documents suivants sont annexes au present contrat et en font partie integrante :")

  const annexes = [
    "Notice d'information relative aux droits et obligations des locataires et bailleurs (decret du 29 mai 2015)",
    "Etat des lieux d'entree signe par les deux parties",
    "Inventaire et etat du mobilier et des equipements du logement",
    "Diagnostics techniques obligatoires : DPE, risques naturels et technologiques (ERNT/ERNMT)",
    "Extrait du reglement de copropriete relatif a la destination de l'immeuble (si applicable)",
  ]
  y -= 2
  for (const a of annexes) {
    bullet(a)
    y -= 2
  }
  y -= 6

  // ── SIGNATURES ─────────────────────────────────────────────────────────────

  const tenants = data.tenants
  const SBH = 80, SBW = 200, SRH = SBH + 32
  const sigNeeded = 90 + (tenants.length <= 1 ? SRH : SRH * (1 + Math.ceil((tenants.length - 1) / 2)))
  checkY(sigNeeded)

  sectionTitle('', 'SIGNATURES DES PARTIES')

  paragraph("Fait en autant d'exemplaires originaux que de parties, chaque signataire reconnaissant avoir recu le sien.")
  y -= 2
  field('Fait le', formatDate(startDateRaw || data.date))
  field('A', data.propertyCity ? sa(data.propertyCity) : '_______________')
  y -= 14

  const drawSigBox = async (bx: number, by: number, label: string, sigDataUrl?: string | null) => {
    page.drawText(sa(label), {
      x: bx, y: by + SBH + 6, size: 8, font: HLVB, color: COL_MID,
    })
    page.drawRectangle({
      x: bx, y: by, width: SBW, height: SBH,
      borderColor: COL_LINE, borderWidth: 1, color: rgb(0.98, 0.99, 1),
    })
    if (sigDataUrl) {
      const sigData = sigDataUrl.replace(/^data:image\/\w+;base64,/, '')
      const sigBytes = Buffer.from(sigData, 'base64')
      try {
        const img = await pdfDoc.embedPng(sigBytes)
        const dims = img.scale(0.3)
        page.drawImage(img, {
          x: bx + 10, y: by + 10,
          width: Math.min(dims.width, SBW - 20),
          height: Math.min(dims.height, SBH - 20),
        })
      } catch { /* ignore embed error */ }
    } else {
      page.drawText('Non signe', {
        x: bx + 70, y: by + SBH / 2 - 4, size: 8,
        font: HLV, color: rgb(0.75, 0.78, 0.85),
      })
    }
  }

  const col0 = M
  const col1 = W / 2 + 10

  if (tenants.length === 0) {
    await drawSigBox(col0, y - SBH, 'Signature du bailleur', data.ownerSignature)
    y -= SRH
  } else if (tenants.length === 1) {
    const rowY = y - SBH
    await drawSigBox(col0, rowY, 'Signature du bailleur', data.ownerSignature)
    await drawSigBox(col1, rowY, `Signature de ${sa(tenants[0].name)}`, tenants[0].signature)
    y = rowY - 20
  } else {
    let rowY = y - SBH
    await drawSigBox(col0, rowY, 'Signature du bailleur', data.ownerSignature)
    await drawSigBox(col1, rowY, `Signature de ${sa(tenants[0].name)}`, tenants[0].signature)
    y = rowY - SRH
    for (let i = 1; i < tenants.length; i += 2) {
      checkY(SRH)
      rowY = y - SBH
      await drawSigBox(col0, rowY, `Signature de ${sa(tenants[i].name)}`, tenants[i].signature)
      if (i + 1 < tenants.length) {
        await drawSigBox(col1, rowY, `Signature de ${sa(tenants[i + 1].name)}`, tenants[i + 1].signature)
      }
      y = rowY - SRH
    }
  }

  addFooter()
  return pdfDoc.save()
}

// ── Inspection PDF (entry / exit) ────────────────────────────────────────────

const PROP_TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement', house: 'Maison', studio: 'Studio', room: 'Chambre', other: 'Autre',
}

async function generateInspectionPDF(data: DocumentData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const HLV  = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const HLVB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const W = 595, H = 842, M = 50, CW = W - M * 2, FOOTER_H = 28
  const ROW_H = 16
  const ROW_ALT = rgb(0.973, 0.973, 0.973)

  let page: PDFPage = null!
  let y = 0
  let pageNum = 0

  const addFooter = () => {
    if (!page) return
    page.drawRectangle({ x: 0, y: 0, width: W, height: FOOTER_H, color: rgb(0.97, 0.97, 0.97) })
    page.drawLine({ start: { x: 0, y: FOOTER_H }, end: { x: W, y: FOOTER_H }, thickness: 0.5, color: COL_LINE })
    page.drawText('Document genere par Leasy Immobilier', { x: M, y: 9, size: 7, font: HLV, color: COL_LIGHT })
    page.drawText(`Page ${pageNum}`, { x: W - M - 25, y: 9, size: 7, font: HLV, color: COL_LIGHT })
  }
  const newPage = () => { addFooter(); page = pdfDoc.addPage([W, H]); pageNum++; y = H - M }
  const checkY = (needed: number) => { if (y < FOOTER_H + needed + 10) newPage() }

  const sectionTitle = (num: string, title: string) => {
    checkY(30)
    y -= 6
    page.drawRectangle({ x: M - 4, y: y - 5, width: CW + 8, height: 21, color: COL_GREEN })
    const label = num ? `${num}. ${sa(title)}` : sa(title)
    page.drawText(label, { x: M + 2, y: y + 2, size: 9, font: HLVB, color: COL_WHITE })
    y -= 24
  }

  const field = (label: string, value: string) => {
    checkY(16)
    page.drawText(`${sa(label)} :`, { x: M, y, size: 9, font: HLVB, color: COL_MID })
    page.drawText(sa(value) || '—', { x: M + 145, y, size: 9, font: HLV, color: COL_DARK })
    y -= 14
  }

  const drawTable = (headers: string[], rows: string[][], colRatios: number[]) => {
    const colW = colRatios.map(r => r * CW)

    const drawHdr = () => {
      checkY(ROW_H + 4)
      page.drawRectangle({ x: M, y: y - ROW_H, width: CW, height: ROW_H, color: COL_GREEN })
      let cx = M
      headers.forEach((h, i) => {
        page.drawText(sa(h), { x: cx + 4, y: y - ROW_H + 5, size: 8, font: HLVB, color: COL_WHITE })
        cx += colW[i]
      })
      y -= ROW_H
    }

    drawHdr()

    rows.forEach((row, j) => {
      if (y < FOOTER_H + ROW_H + 4) { newPage(); drawHdr() }
      if (j % 2 === 1) page.drawRectangle({ x: M, y: y - ROW_H, width: CW, height: ROW_H, color: ROW_ALT })
      let cx = M
      row.forEach((cell, i) => {
        let txt = sa(String(cell ?? ''))
        const maxW = colW[i] - 8
        if (HLV.widthOfTextAtSize(txt, 8) > maxW) {
          while (txt.length > 4 && HLV.widthOfTextAtSize(txt.slice(0, -4) + '...', 8) > maxW) txt = txt.slice(0, -1)
          txt = txt.slice(0, txt.length - 3) + '...'
        }
        page.drawText(txt, { x: cx + 4, y: y - ROW_H + 5, size: 8, font: HLV, color: COL_DARK })
        cx += colW[i]
      })
      page.drawLine({ start: { x: M, y: y - ROW_H }, end: { x: M + CW, y: y - ROW_H }, thickness: 0.3, color: COL_LINE })
      y -= ROW_H
    })
  }

  const c = (data.content ?? {}) as Record<string, any>
  const isExit = data.type === 'exit_inspection'

  // ── PAGE 1 — HEADER ────────────────────────────────────────────

  newPage()

  const HDR = 60
  page.drawRectangle({ x: 0, y: H - HDR, width: W, height: HDR, color: COL_GREEN })
  page.drawRectangle({ x: 0, y: H - HDR - 3, width: W, height: 3, color: COL_ACCENT })
  page.drawText(isExit ? "ETAT DES LIEUX DE SORTIE" : "ETAT DES LIEUX D ENTREE", {
    x: M, y: H - 36, size: 16, font: HLVB, color: COL_WHITE,
  })
  page.drawText("Conforme a la loi ALUR", { x: M, y: H - 52, size: 9, font: HLV, color: COL_ACCENT })

  y = H - HDR - 15

  // NOMENCLATURE
  const NOM_H = 50
  checkY(NOM_H + 10)
  page.drawRectangle({ x: M, y: y - NOM_H, width: CW, height: NOM_H, color: rgb(0.97, 0.97, 0.97), borderColor: COL_LINE, borderWidth: 0.5 })
  page.drawText('NOMENCLATURE :', { x: M + 8, y: y - 13, size: 8, font: HLVB, color: COL_MID })
  const nomLines = [
    'A : tres bon etat / neuf            D : mauvais etat',
    'B : bon etat                        HS : hors service',
    'C : etat d usage                    NV : non-verifie',
  ]
  nomLines.forEach((l, i) => { page.drawText(l, { x: M + 8, y: y - 26 - i * 10, size: 8, font: HLV, color: COL_DARK }) })
  y -= NOM_H + 10

  // ── 1. BAILLEUR ────────────────────────────────────────────────
  sectionTitle('1', 'BAILLEUR')
  field('Nom', data.ownerName)
  field('Adresse', data.ownerAddress)
  if (data.ownerEmail) field('Email', data.ownerEmail)
  if (data.ownerPhone) field('Telephone', data.ownerPhone)
  y -= 6

  // ── 2. LOCATAIRES ──────────────────────────────────────────────
  sectionTitle('2', data.tenants.length > 1 ? 'LOCATAIRES' : 'LOCATAIRE')
  if (data.tenants.length === 0) {
    checkY(14); page.drawText('—', { x: M + 10, y, size: 9, font: HLV, color: COL_LIGHT }); y -= 14
  } else {
    for (const t of data.tenants) {
      field('Nom', t.name)
      if (t.email) field('Email', t.email)
      if (t.phone) field('Telephone', t.phone)
    }
  }
  y -= 6

  // ── 3. LOCAUX ──────────────────────────────────────────────────
  sectionTitle('3', 'LOCAUX')
  field('Type de logement', data.propertyType ? (PROP_TYPE_LABELS[data.propertyType] ?? sa(data.propertyType)) : '—')
  field('Adresse', `${sa(data.propertyAddress)}, ${data.propertyPostalCode} ${sa(data.propertyCity)}`)
  if (c.surface)      field('Surface', `${c.surface} m2`)
  if (c.rooms_count)  field('Nombre de pieces', String(c.rooms_count))
  if (c.inspection_date) field('Date de l etat des lieux', formatDateDMY(c.inspection_date))
  if (c.description && sa(c.description).trim()) {
    checkY(14); page.drawText('Description :', { x: M, y, size: 9, font: HLVB, color: COL_MID }); y -= 13
    for (const line of wrapLines(sa(c.description), HLV, 8.5, CW - 10)) {
      checkY(12); page.drawText(line, { x: M + 10, y, size: 8.5, font: HLV, color: COL_DARK }); y -= 13
    }
  }
  y -= 6

  // ── 4. MOYENS D'ACCES ─────────────────────────────────────────
  sectionTitle('4', "MOYENS D ACCES")
  const accessKeys = Array.isArray(c.access_keys) ? c.access_keys : []
  if (accessKeys.length > 0) {
    drawTable(
      ['Type', 'Destination', 'Quantite'],
      accessKeys.map((k: any) => [k.key_type ?? '', k.destination ?? '', String(k.quantity ?? '')]),
      [0.3, 0.5, 0.2]
    )
  } else {
    checkY(14); page.drawText('Aucun moyen d acces renseigne.', { x: M + 10, y, size: 8.5, font: HLV, color: COL_LIGHT }); y -= 14
  }
  y -= 8

  // ── 5. ACCESSOIRES ────────────────────────────────────────────
  sectionTitle('5', 'ACCESSOIRES ET EQUIPEMENTS')
  const accessories = Array.isArray(c.accessories) ? c.accessories : []
  if (accessories.length > 0) {
    drawTable(
      ['Accessoire', 'Etat'],
      accessories.map((a: any) => [a.name ?? '', a.condition ?? '']),
      [0.75, 0.25]
    )
  } else {
    checkY(14); page.drawText('Aucun accessoire renseigne.', { x: M + 10, y, size: 8.5, font: HLV, color: COL_LIGHT }); y -= 14
  }
  y -= 8

  // ── 6. CHAUFFAGE ──────────────────────────────────────────────
  sectionTitle('6', 'CHAUFFAGE')
  const h = (c.heating ?? {}) as Record<string, any>
  field('Type', sa(h.type ?? ''))
  field('Localisation', sa(h.location ?? ''))
  field('Etat general', sa(h.general_condition ?? ''))
  if (h.radiator_count) {
    field('Nombre de radiateurs', String(h.radiator_count))
    field('Etat des radiateurs', sa(h.radiator_condition ?? ''))
  }
  y -= 6

  // ── 7. RELEVE DES COMPTEURS ───────────────────────────────────
  sectionTitle('7', 'RELEVE DES COMPTEURS')
  const meters = Array.isArray(c.meters) ? c.meters : []
  if (meters.length > 0) {
    drawTable(
      ['Energie', 'Fournisseur', 'Localisation', 'Releve', 'Date'],
      meters.map((m: any) => [
        m.energy_type ?? '', m.provider ?? '', m.location ?? '',
        m.reading ?? '', m.reading_date ? formatDateDMY(m.reading_date) : '',
      ]),
      [0.15, 0.18, 0.27, 0.18, 0.22]
    )
  } else {
    checkY(14); page.drawText('Aucun compteur renseigne.', { x: M + 10, y, size: 8.5, font: HLV, color: COL_LIGHT }); y -= 14
  }
  y -= 8

  // ── 8+. PIECES ────────────────────────────────────────────────
  const rooms = Array.isArray(c.rooms) ? c.rooms : []
  rooms.forEach((room: any, ri: number) => {
    sectionTitle(String(8 + ri), sa(room.name ?? `Piece ${ri + 1}`).toUpperCase())
    const elements = Array.isArray(room.elements) ? room.elements : []
    if (elements.length > 0) {
      drawTable(
        ['Element', 'Description / Commentaire', 'Etat'],
        elements.map((el: any) => {
          const desc = [sa(el.description ?? ''), sa(el.comment ?? '')].filter(Boolean).join(' / ')
          return [el.name ?? '', desc, el.condition ?? '']
        }),
        [0.28, 0.57, 0.15]
      )
    } else {
      checkY(14); page.drawText('Aucun element renseigne.', { x: M + 10, y, size: 8.5, font: HLV, color: COL_LIGHT }); y -= 14
    }
    if (room.remarks && sa(room.remarks).trim()) {
      y -= 4; checkY(13)
      const remarkLines = wrapLines(`Remarques : ${sa(room.remarks)}`, HLV, 8, CW - 10)
      for (const line of remarkLines) { checkY(12); page.drawText(line, { x: M + 10, y, size: 8, font: HLV, color: COL_MID }); y -= 12 }
    }
    y -= 6
  })

  // ── OBSERVATIONS ET SIGNATURES ────────────────────────────────
  sectionTitle('', 'OBSERVATIONS ET SIGNATURES')

  if (c.general_observations && sa(c.general_observations).trim()) {
    checkY(14); page.drawText('Observations generales :', { x: M, y, size: 9, font: HLVB, color: COL_MID }); y -= 14
    for (const line of wrapLines(sa(c.general_observations), HLV, 8.5, CW - 10)) {
      checkY(12); page.drawText(line, { x: M + 10, y, size: 8.5, font: HLV, color: COL_DARK }); y -= 13
    }
    y -= 6
  }

  const legalText = "Le present etat des lieux etabli contradictoirement entre les parties qui le reconnaissent, fait partie integrante du contrat de location dont il ne peut etre dissocie."
  for (const line of wrapLines(legalText, HLV, 8, CW - 4)) {
    checkY(12); page.drawText(line, { x: M + 2, y, size: 8, font: HLV, color: COL_MID }); y -= 12
  }
  y -= 8

  const location = sa(c.location ?? data.propertyCity ?? '')
  const copies = c.copies_count ?? 2
  checkY(14)
  page.drawText(
    `Fait a ${location}, le ${formatDateDMY(c.inspection_date ?? data.date)}, en ${copies} exemplaire${copies > 1 ? 's' : ''}.`,
    { x: M, y, size: 9, font: HLV, color: COL_DARK }
  )
  y -= 24

  // Signatures
  const SBH = 80
  const SBW = (CW - 20) / 2
  checkY(SBH + 40)

  const drawSigBox = async (bx: number, by: number, label: string, subLabel: string, sigDataUrl?: string | null) => {
    page.drawText(sa(label),    { x: bx, y: by + SBH + 14, size: 9, font: HLVB, color: COL_MID })
    page.drawText(sa(subLabel), { x: bx, y: by + SBH +  3, size: 8, font: HLV,  color: COL_LIGHT })
    page.drawRectangle({ x: bx, y: by, width: SBW, height: SBH, borderColor: COL_LINE, borderWidth: 1, color: rgb(0.98, 0.99, 1) })
    if (sigDataUrl) {
      try {
        const sigData = sigDataUrl.replace(/^data:image\/\w+;base64,/, '')
        const img = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'))
        const d = img.scale(0.3)
        page.drawImage(img, { x: bx + 8, y: by + 8, width: Math.min(d.width, SBW - 16), height: Math.min(d.height, SBH - 16) })
      } catch { /* ignore */ }
    } else {
      page.drawText('Non signe', { x: bx + SBW / 2 - 22, y: by + SBH / 2 - 4, size: 8, font: HLV, color: rgb(0.75, 0.78, 0.85) })
    }
  }

  await drawSigBox(M,          y - SBH, 'Le(s) bailleur(s)',   'certifie(nt) exact', data.ownerSignature)
  await drawSigBox(M + SBW + 20, y - SBH, 'Le(s) locataire(s)', 'certifie(nt) exact', data.tenants[0]?.signature ?? null)

  addFooter()
  return pdfDoc.save()
}

// ── Inventory PDF ─────────────────────────────────────────────────────────────

async function generateInventoryPDF(data: DocumentData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const HLV  = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const HLVB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const W = 595, H = 842, M = 50, CW = W - M * 2, FOOTER_H = 28
  const ROW_H = 16
  const ROW_ALT = rgb(0.973, 0.973, 0.973)

  let page: PDFPage = null!
  let y = 0
  let pageNum = 0

  const addFooter = () => {
    if (!page) return
    page.drawRectangle({ x: 0, y: 0, width: W, height: FOOTER_H, color: rgb(0.97, 0.97, 0.97) })
    page.drawLine({ start: { x: 0, y: FOOTER_H }, end: { x: W, y: FOOTER_H }, thickness: 0.5, color: COL_LINE })
    page.drawText('Document genere par Leasy Immobilier', { x: M, y: 9, size: 7, font: HLV, color: COL_LIGHT })
    page.drawText(`Page ${pageNum}`, { x: W - M - 25, y: 9, size: 7, font: HLV, color: COL_LIGHT })
  }
  const newPage = () => { addFooter(); page = pdfDoc.addPage([W, H]); pageNum++; y = H - M }
  const checkY  = (needed: number) => { if (y < FOOTER_H + needed + 10) newPage() }

  const sectionTitle = (num: string, title: string) => {
    checkY(30); y -= 6
    page.drawRectangle({ x: M - 4, y: y - 5, width: CW + 8, height: 21, color: COL_GREEN })
    const label = num ? `${num}. ${sa(title)}` : sa(title)
    page.drawText(label, { x: M + 2, y: y + 2, size: 9, font: HLVB, color: COL_WHITE })
    y -= 24
  }
  const field = (label: string, value: string) => {
    checkY(16)
    page.drawText(`${sa(label)} :`, { x: M, y, size: 9, font: HLVB, color: COL_MID })
    page.drawText(sa(value) || '—', { x: M + 145, y, size: 9, font: HLV, color: COL_DARK })
    y -= 14
  }
  const drawTable = (headers: string[], rows: string[][], colRatios: number[]) => {
    const colW = colRatios.map(r => r * CW)
    const drawHdr = () => {
      checkY(ROW_H + 4)
      page.drawRectangle({ x: M, y: y - ROW_H, width: CW, height: ROW_H, color: COL_GREEN })
      let cx = M
      headers.forEach((h, i) => { page.drawText(sa(h), { x: cx + 4, y: y - ROW_H + 5, size: 8, font: HLVB, color: COL_WHITE }); cx += colW[i] })
      y -= ROW_H
    }
    drawHdr()
    rows.forEach((row, j) => {
      if (y < FOOTER_H + ROW_H + 4) { newPage(); drawHdr() }
      if (j % 2 === 1) page.drawRectangle({ x: M, y: y - ROW_H, width: CW, height: ROW_H, color: ROW_ALT })
      let cx = M
      row.forEach((cell, i) => {
        let txt = sa(String(cell ?? ''))
        const maxW = colW[i] - 8
        if (HLV.widthOfTextAtSize(txt, 8) > maxW) {
          while (txt.length > 4 && HLV.widthOfTextAtSize(txt.slice(0, -4) + '...', 8) > maxW) txt = txt.slice(0, -1)
          txt = txt.slice(0, txt.length - 3) + '...'
        }
        page.drawText(txt, { x: cx + 4, y: y - ROW_H + 5, size: 8, font: HLV, color: COL_DARK })
        cx += colW[i]
      })
      page.drawLine({ start: { x: M, y: y - ROW_H }, end: { x: M + CW, y: y - ROW_H }, thickness: 0.3, color: COL_LINE })
      y -= ROW_H
    })
  }

  const c = (data.content ?? {}) as Record<string, any>

  newPage()

  const HDR = 60
  page.drawRectangle({ x: 0, y: H - HDR, width: W, height: HDR, color: COL_GREEN })
  page.drawRectangle({ x: 0, y: H - HDR - 3, width: W, height: 3, color: COL_ACCENT })
  page.drawText('INVENTAIRE DU MOBILIER', { x: M, y: H - 36, size: 16, font: HLVB, color: COL_WHITE })
  page.drawText('Conforme a la loi ALUR', { x: M, y: H - 52, size: 9, font: HLV, color: COL_ACCENT })

  y = H - HDR - 20

  sectionTitle('1', 'BAILLEUR')
  field('Nom', data.ownerName)
  field('Adresse', data.ownerAddress)
  if (data.ownerEmail) field('Email', data.ownerEmail)
  if (data.ownerPhone) field('Telephone', data.ownerPhone)
  y -= 6

  sectionTitle('2', data.tenants.length > 1 ? 'LOCATAIRES' : 'LOCATAIRE')
  if (data.tenants.length === 0) {
    checkY(14); page.drawText('—', { x: M + 10, y, size: 9, font: HLV, color: COL_LIGHT }); y -= 14
  } else {
    for (const t of data.tenants) {
      field('Nom', t.name)
      if (t.email) field('Email', t.email)
      if (t.phone) field('Telephone', t.phone)
    }
  }
  y -= 6

  sectionTitle('3', 'BIEN')
  field('Type de logement', data.propertyType ? (PROP_TYPE_LABELS[data.propertyType] ?? sa(data.propertyType)) : '—')
  field('Adresse', `${sa(data.propertyAddress)}, ${data.propertyPostalCode} ${sa(data.propertyCity)}`)
  if (c.surface)      field('Surface', `${c.surface} m2`)
  if (c.rooms_count)  field('Nombre de pieces', String(c.rooms_count))
  if (c.inventory_date) field('Date de l inventaire', formatDateDMY(c.inventory_date))
  y -= 6

  const rooms = Array.isArray(c.rooms) ? c.rooms : []
  rooms.forEach((room: any, ri: number) => {
    sectionTitle(String(4 + ri), sa(room.name ?? `Piece ${ri + 1}`).toUpperCase())
    const items = Array.isArray(room.items) ? room.items : []
    if (items.length > 0) {
      drawTable(
        ['Objet', 'Quantite', 'Etat', 'Commentaire'],
        items.map((item: any) => [
          item.name ?? '', String(item.quantity ?? 1), item.condition ?? '', sa(item.comment ?? ''),
        ]),
        [0.40, 0.10, 0.25, 0.25]
      )
    } else {
      checkY(14); page.drawText('Aucun objet renseigne.', { x: M + 10, y, size: 8.5, font: HLV, color: COL_LIGHT }); y -= 14
    }
    y -= 6
  })

  sectionTitle('', 'OBSERVATIONS ET SIGNATURES')

  if (c.general_observations && sa(c.general_observations).trim()) {
    checkY(14); page.drawText('Observations generales :', { x: M, y, size: 9, font: HLVB, color: COL_MID }); y -= 14
    for (const line of wrapLines(sa(c.general_observations), HLV, 8.5, CW - 10)) {
      checkY(12); page.drawText(line, { x: M + 10, y, size: 8.5, font: HLV, color: COL_DARK }); y -= 13
    }
    y -= 6
  }

  const legalText = "Le present inventaire etabli contradictoirement entre les parties qui le reconnaissent, fait partie integrante du contrat de location dont il ne peut etre dissocie."
  for (const line of wrapLines(legalText, HLV, 8, CW - 4)) {
    checkY(12); page.drawText(line, { x: M + 2, y, size: 8, font: HLV, color: COL_MID }); y -= 12
  }
  y -= 8

  const location = sa(c.location ?? data.propertyCity ?? '')
  const copies = c.copies_count ?? 2
  checkY(14)
  page.drawText(
    `Fait a ${location}, le ${formatDateDMY(c.inventory_date ?? data.date)}, en ${copies} exemplaire${copies > 1 ? 's' : ''}.`,
    { x: M, y, size: 9, font: HLV, color: COL_DARK }
  )
  y -= 24

  const SBH = 80
  const SBW = (CW - 20) / 2
  checkY(SBH + 40)

  const drawSigBox = async (bx: number, by: number, label: string, subLabel: string, sigDataUrl?: string | null) => {
    page.drawText(sa(label),    { x: bx, y: by + SBH + 14, size: 9, font: HLVB, color: COL_MID })
    page.drawText(sa(subLabel), { x: bx, y: by + SBH +  3, size: 8, font: HLV,  color: COL_LIGHT })
    page.drawRectangle({ x: bx, y: by, width: SBW, height: SBH, borderColor: COL_LINE, borderWidth: 1, color: rgb(0.98, 0.99, 1) })
    if (sigDataUrl) {
      try {
        const sigData = sigDataUrl.replace(/^data:image\/\w+;base64,/, '')
        const img = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'))
        const d = img.scale(0.3)
        page.drawImage(img, { x: bx + 8, y: by + 8, width: Math.min(d.width, SBW - 16), height: Math.min(d.height, SBH - 16) })
      } catch { /* ignore */ }
    } else {
      page.drawText('Non signe', { x: bx + SBW / 2 - 22, y: by + SBH / 2 - 4, size: 8, font: HLV, color: rgb(0.75, 0.78, 0.85) })
    }
  }

  await drawSigBox(M,              y - SBH, 'Le(s) bailleur(s)',   'certifie(nt) exact', data.ownerSignature)
  await drawSigBox(M + SBW + 20,   y - SBH, 'Le(s) locataire(s)', 'certifie(nt) exact', data.tenants[0]?.signature ?? null)

  addFooter()
  return pdfDoc.save()
}
