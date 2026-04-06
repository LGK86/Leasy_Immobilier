import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

import { createClient } from '@supabase/supabase-js'
import * as https from 'https'
import * as http from 'http'

const supabaseUrl = process.env.IMPORT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.IMPORT_SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface RentControlRow {
  city: string
  zone_id: string
  zone_name: string
  rooms_count: number
  construction_period: string
  rental_type: 'furnished' | 'unfurnished'
  ref_price: number
  max_price: number
  min_price: number
  year: number
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function parsePeriod(epoque: string): string {
  const e = (epoque ?? '').toLowerCase().trim()
  if (e.includes('avant') && e.includes('46')) return 'avant_1946'
  if (e.includes('1946') || (e.includes('46') && e.includes('70'))) return '1946_1970'
  if (e.includes('1971') || e.includes('71') || (e.includes('70') && e.includes('90'))) return '1971_1990'
  return 'apres_1990'
}

async function importParis(): Promise<RentControlRow[]> {
  console.log('[paris] Téléchargement...')
  const url = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/logement-encadrement-des-loyers/exports/csv?lang=fr&timezone=Europe%2FParis&use_labels=true&delimiter=%3B'
  const csv = await fetchUrl(url)
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) {
    console.warn('[paris] CSV vide ou inaccessible')
    return []
  }

  const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''))
  console.log('[paris] Colonnes :', headers.join(', '))

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const normHeaders = headers.map(norm)

  const colIdx = (pattern: string, exclude?: string) => {
    const p = norm(pattern)
    const e = exclude ? norm(exclude) : null
    return normHeaders.findIndex(h => h.includes(p) && (!e || !h.includes(e)))
  }

  const iPiece    = colIdx('piece')
  const iEpoque   = colIdx('epoque') >= 0 ? colIdx('epoque') : colIdx('construction')
  const iType     = colIdx('type de location') >= 0 ? colIdx('type de location') : colIdx('location')
  const iZoneId   = colIdx('numero du quartier') >= 0 ? colIdx('numero du quartier') : colIdx('quartier')
  const iZoneName = colIdx('nom du quartier') >= 0 ? colIdx('nom du quartier') : colIdx('nom_quartier')
  const iRef      = colIdx('loyers de reference') >= 0 ? colIdx('loyers de reference') :
                    colIdx('reference', 'major') >= 0 ? colIdx('reference', 'major') : colIdx('ref', 'max')
  const iMax      = colIdx('majore') >= 0 ? colIdx('majore') : colIdx('major')
  const iMin      = colIdx('minore') >= 0 ? colIdx('minore') : colIdx('minor')
  const iAnnee    = colIdx('annee')

  console.log(`[paris] Index colonnes — piece:${iPiece} epoque:${iEpoque} type:${iType} ref:${iRef} max:${iMax} min:${iMin} zone:${iZoneId} nom:${iZoneName} annee:${iAnnee}`)

  const rows: RentControlRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 4) continue

    const pieceRaw    = iPiece    >= 0 ? cols[iPiece]    : ''
    const epoqueRaw   = iEpoque   >= 0 ? cols[iEpoque]   : ''
    const meubleRaw   = iType     >= 0 ? cols[iType]     : ''
    const refRaw      = iRef      >= 0 ? cols[iRef]      : ''
    const maxRaw      = iMax      >= 0 ? cols[iMax]      : ''
    const minRaw      = iMin      >= 0 ? cols[iMin]      : ''
    const zoneIdRaw   = iZoneId   >= 0 ? cols[iZoneId]   : ''
    const zoneNameRaw = iZoneName >= 0 ? cols[iZoneName] : ''
    const anneeRaw    = iAnnee    >= 0 ? cols[iAnnee]    : ''

    const piece = parseInt(pieceRaw)
    const ref   = parseFloat(refRaw.replace(',', '.'))
    const max   = parseFloat(maxRaw.replace(',', '.'))
    const min   = parseFloat(minRaw.replace(',', '.'))

    if (isNaN(piece) || isNaN(ref) || isNaN(max) || isNaN(min)) continue

    const meubleNorm = norm(meubleRaw)
    const rental_type: 'furnished' | 'unfurnished' =
      meubleNorm.includes('non') ? 'unfurnished' :
      meubleNorm.includes('meubl') ? 'furnished' : 'unfurnished'

    const year = parseInt(anneeRaw) || 2024

    rows.push({
      city: 'paris',
      zone_id: zoneIdRaw,
      zone_name: zoneNameRaw,
      rooms_count: Math.min(piece, 5),
      construction_period: parsePeriod(epoqueRaw),
      rental_type,
      ref_price: ref,
      max_price: max,
      min_price: min,
      year,
    })
  }

  console.log(`[paris] ${rows.length} lignes parsées`)

  const maxYear = Math.max(...rows.map(r => r.year))
  const filteredRows = rows.filter(r => r.year === maxYear)
  console.log(`[paris] Millésime retenu : ${maxYear} (${filteredRows.length} lignes)`)
  return filteredRows
}

async function importLyon(): Promise<RentControlRow[]> {
  console.log('[lyon] Téléchargement...')
  const url = 'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=car_care.carencadrmtloyer_latest&outputFormat=application/json'
  let raw: string
  try {
    raw = await fetchUrl(url)
  } catch (e) {
    console.warn('[lyon] Erreur de téléchargement:', e)
    return []
  }

  let geojson: any
  try {
    geojson = JSON.parse(raw)
  } catch {
    console.warn('[lyon] JSON invalide')
    return []
  }

  const features = geojson?.features ?? []
  console.log(`[lyon] ${features.length} features GeoJSON`)

  const rows: RentControlRow[] = []
  const YEAR = 2024

  for (const feat of features) {
    const p = feat.properties ?? {}
    const piece    = parseInt(p.nb_piece ?? p.nbpiece ?? p.pieces ?? '')
    const ref      = parseFloat(p.ref ?? p.loyer_ref ?? p.loyerref ?? '')
    const max      = parseFloat(p.max ?? p.loyer_max ?? p.loyermax ?? '')
    const min      = parseFloat(p.min ?? p.loyer_min ?? p.loyermin ?? '')
    const epoque   = p.epoque ?? p.periode_construction ?? p.annee_construction ?? ''
    const meuble   = p.meuble ?? p.type_location ?? p.furnished ?? ''
    const zoneId   = String(p.id_zone ?? p.zone_id ?? p.identifiant ?? '')
    const zoneName = p.nom_quartier ?? p.quartier ?? p.libelle ?? p.zone_name ?? ''

    if (isNaN(piece) || isNaN(ref) || isNaN(max) || isNaN(min)) continue

    const meubleNorm = String(meuble).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const rental_type: 'furnished' | 'unfurnished' =
      meubleNorm.includes('non') ? 'unfurnished' :
      meubleNorm.includes('meubl') ? 'furnished' : 'unfurnished'

    rows.push({
      city: 'lyon',
      zone_id: zoneId,
      zone_name: String(zoneName),
      rooms_count: Math.min(piece, 5),
      construction_period: parsePeriod(String(epoque)),
      rental_type,
      ref_price: ref,
      max_price: max,
      min_price: min,
      year: YEAR,
    })
  }

  console.log(`[lyon] ${rows.length} lignes parsées`)
  return rows
}

async function insertBatch(rows: RentControlRow[]) {
  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('rent_control_zones').insert(batch)
    if (error) {
      console.error(`Erreur insert batch ${i}-${i + BATCH}:`, error.message)
    } else {
      inserted += batch.length
    }
  }
  return inserted
}

async function main() {
  console.log('=== Import encadrement des loyers ===')

  console.log('Vidage de la table rent_control_zones...')
  const { error: truncErr } = await supabase.rpc('truncate_rent_control_zones')
  if (truncErr) {
    await supabase.from('rent_control_zones').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const parisRows = await importParis()
  const lyonRows = await importLyon()

  const parisInserted = await insertBatch(parisRows)
  console.log(`[paris] ${parisInserted} enregistrements insérés`)

  const lyonInserted = await insertBatch(lyonRows)
  console.log(`[lyon] ${lyonInserted} enregistrements insérés`)

  console.log(`=== Total : ${parisInserted + lyonInserted} enregistrements ===`)
}

main().catch(console.error)
