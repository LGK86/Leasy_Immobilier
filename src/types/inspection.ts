// Nomenclature état des lieux (loi ALUR)
// A = Tres bon etat / Neuf
// B = Bon etat
// C = Etat d'usage
// D = Mauvais etat
// HS = Hors service
// NV = Non verifie
export type InspectionCondition = 'A' | 'B' | 'C' | 'D' | 'HS' | 'NV'

// Nomenclature inventaire
export type InventoryCondition = 'Neuf' | 'Bon' | 'Moyen' | 'Tres abime'

// --- État des lieux ---

export interface AccessKey {
  key_type: string
  destination: string
  quantity: number
}

export interface Accessory {
  name: string
  condition: InspectionCondition
}

export interface Heating {
  type: string
  location: string
  general_condition: string
  radiator_count: number
  radiator_condition: string
}

export interface Meter {
  energy_type: string
  provider: string
  location: string
  reading: string
  reading_date: string
}

export interface RoomElement {
  name: string
  description: string
  condition: InspectionCondition
  comment: string
}

export interface InspectionRoom {
  id: string
  name: string
  order: number
  elements: RoomElement[]
  remarks: string
}

export interface InspectionContent {
  type: 'entry' | 'exit'
  inspection_date: string
  description: string
  surface?: number | null
  rooms_count?: number | null
  access_keys: AccessKey[]
  accessories: Accessory[]
  heating: Heating
  meters: Meter[]
  rooms: InspectionRoom[]
  general_observations: string
  location: string
  copies_count: number
  linked_inspection_id?: string | null
}

// --- Inventaire ---

export interface InventoryItem {
  name: string
  quantity: number
  condition: InventoryCondition
  comment: string
}

export interface InventoryRoom {
  id: string
  name: string
  order: number
  items: InventoryItem[]
}

export interface InventoryContent {
  inventory_date: string
  linked_inspection_id: string | null
  surface?: number | null
  rooms_count?: number | null
  rooms: InventoryRoom[]
  general_observations: string
  location: string
  copies_count: number
}
