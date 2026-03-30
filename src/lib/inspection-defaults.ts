import type {
  AccessKey,
  Accessory,
  Meter,
  InspectionRoom,
  InspectionContent,
  InventoryRoom,
  InventoryContent,
} from '@/types/inspection'

// ---------------------------------------------------------------------------
// Pièces par défaut — État des lieux
// Tous les éléments : condition 'A', description '', comment ''
// ---------------------------------------------------------------------------

export const DEFAULT_INSPECTION_ROOMS: InspectionRoom[] = [
  {
    id: 'room_1',
    name: 'Entree / Couloir',
    order: 1,
    elements: [
      { name: 'Porte(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Murs',            description: '', condition: 'A', comment: '' },
      { name: 'Plafond',         description: '', condition: 'A', comment: '' },
      { name: 'Sol',             description: '', condition: 'A', comment: '' },
      { name: 'Interrupteur(s)', description: '', condition: 'A', comment: '' },
      { name: 'Prise(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Autre(s)',        description: '', condition: 'A', comment: '' },
    ],
    remarks: '',
  },
  {
    id: 'room_2',
    name: 'Sejour',
    order: 2,
    elements: [
      { name: 'Murs',            description: '', condition: 'A', comment: '' },
      { name: 'Plafond',         description: '', condition: 'A', comment: '' },
      { name: 'Sol',             description: '', condition: 'A', comment: '' },
      { name: 'Fenetre(s)',      description: '', condition: 'A', comment: '' },
      { name: 'Volet(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Interrupteur(s)', description: '', condition: 'A', comment: '' },
      { name: 'Prise(s)',        description: '', condition: 'A', comment: '' },
    ],
    remarks: '',
  },
  {
    id: 'room_3',
    name: 'Cuisine',
    order: 3,
    elements: [
      { name: 'Murs',            description: '', condition: 'A', comment: '' },
      { name: 'Plafond',         description: '', condition: 'A', comment: '' },
      { name: 'Sol',             description: '', condition: 'A', comment: '' },
      { name: 'Fenetre(s)',      description: '', condition: 'A', comment: '' },
      { name: 'Interrupteur(s)', description: '', condition: 'A', comment: '' },
      { name: 'Prise(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Meuble(s)',       description: '', condition: 'A', comment: '' },
      { name: 'Evier',           description: '', condition: 'A', comment: '' },
      { name: 'Robinetterie',    description: '', condition: 'A', comment: '' },
      { name: 'Electromenager',  description: '', condition: 'A', comment: '' },
    ],
    remarks: '',
  },
  {
    id: 'room_4',
    name: 'Salle de bain / WC',
    order: 4,
    elements: [
      { name: 'Porte(s)',          description: '', condition: 'A', comment: '' },
      { name: 'Murs',              description: '', condition: 'A', comment: '' },
      { name: 'Plafond',           description: '', condition: 'A', comment: '' },
      { name: 'Sol',               description: '', condition: 'A', comment: '' },
      { name: 'Fenetre(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Interrupteur(s)',   description: '', condition: 'A', comment: '' },
      { name: 'Prise(s)',          description: '', condition: 'A', comment: '' },
      { name: 'Meuble(s)',         description: '', condition: 'A', comment: '' },
      { name: "Element(s) d eau",  description: '', condition: 'A', comment: '' },
      { name: 'WC',                description: '', condition: 'A', comment: '' },
      { name: 'Autre(s)',          description: '', condition: 'A', comment: '' },
    ],
    remarks: '',
  },
  {
    id: 'room_5',
    name: 'Chambre',
    order: 5,
    elements: [
      { name: 'Porte(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Murs',            description: '', condition: 'A', comment: '' },
      { name: 'Plafond',         description: '', condition: 'A', comment: '' },
      { name: 'Sol',             description: '', condition: 'A', comment: '' },
      { name: 'Fenetre(s)',      description: '', condition: 'A', comment: '' },
      { name: 'Volet(s)',        description: '', condition: 'A', comment: '' },
      { name: 'Interrupteur(s)', description: '', condition: 'A', comment: '' },
      { name: 'Prise(s)',        description: '', condition: 'A', comment: '' },
    ],
    remarks: '',
  },
]

// ---------------------------------------------------------------------------
// Accessoires par défaut
// ---------------------------------------------------------------------------

export const DEFAULT_ACCESSORIES: Accessory[] = [
  { name: 'Sonnette',                          condition: 'A' },
  { name: 'Boite aux lettres',                 condition: 'A' },
  { name: 'Detecteur de fumee (obligatoire)',  condition: 'A' },
  { name: 'Detecteur de monoxyde de carbone',  condition: 'A' },
]

// ---------------------------------------------------------------------------
// Compteurs par défaut
// ---------------------------------------------------------------------------

export const DEFAULT_METERS: Meter[] = [
  { energy_type: 'Electricite', provider: '', location: '', reading: '', reading_date: '' },
  { energy_type: 'Gaz',         provider: '', location: '', reading: '', reading_date: '' },
]

// ---------------------------------------------------------------------------
// Clés par défaut (tableau vide — à renseigner par l'utilisateur)
// ---------------------------------------------------------------------------

export const DEFAULT_ACCESS_KEYS: AccessKey[] = []

// ---------------------------------------------------------------------------
// Contenu vide pour un nouvel état des lieux
// ---------------------------------------------------------------------------

export function createDefaultInspectionContent(
  type: 'entry' | 'exit'
): InspectionContent {
  return {
    type,
    inspection_date: '',
    description: '',
    access_keys: [...DEFAULT_ACCESS_KEYS],
    accessories: DEFAULT_ACCESSORIES.map((a) => ({ ...a })),
    heating: {
      type: '',
      location: '',
      general_condition: '',
      radiator_count: 0,
      radiator_condition: '',
    },
    meters: DEFAULT_METERS.map((m) => ({ ...m })),
    rooms: DEFAULT_INSPECTION_ROOMS.map((room) => ({
      ...room,
      elements: room.elements.map((el) => ({ ...el })),
    })),
    general_observations: '',
    location: '',
    copies_count: 2,
  }
}

// ---------------------------------------------------------------------------
// Pièces par défaut — Inventaire
// ---------------------------------------------------------------------------

export const DEFAULT_INVENTORY_ROOMS: InventoryRoom[] = [
  { id: 'room_1', name: 'Sejour / Salle a manger', order: 1, items: [] },
  { id: 'room_2', name: 'Cuisine',                  order: 2, items: [] },
  { id: 'room_3', name: 'Chambre',                  order: 3, items: [] },
]

// ---------------------------------------------------------------------------
// Contenu vide pour un nouvel inventaire
// ---------------------------------------------------------------------------

export function createDefaultInventoryContent(): InventoryContent {
  return {
    inventory_date: '',
    linked_inspection_id: null,
    rooms: DEFAULT_INVENTORY_ROOMS.map((room) => ({ ...room, items: [] })),
    general_observations: '',
    location: '',
    copies_count: 2,
  }
}
