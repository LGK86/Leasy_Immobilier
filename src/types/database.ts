export type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  created_at: string
  updated_at: string
}

export type Property = {
  id: string
  owner_id: string
  address: string
  city: string
  postal_code: string
  type: 'apartment' | 'house' | 'studio' | 'commercial' | 'other'
  monthly_rent: number
  charges: number
  deposit: number
  status: 'rented' | 'vacant'
  description: string | null
  created_at: string
  updated_at: string
}

export type Tenant = {
  id: string
  owner_id: string
  property_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  entry_date: string | null
  lease_end_date: string | null
  created_at: string
  updated_at: string
  property?: Property
}

export type RentPayment = {
  id: string
  owner_id: string
  property_id: string
  tenant_id: string
  amount: number
  charges: number
  payment_date: string | null
  period_month: number
  period_year: number
  status: 'paid' | 'pending' | 'late'
  notes: string | null
  created_at: string
  updated_at: string
  property?: Property
  tenant?: Tenant
}

export type RentReceipt = {
  id: string
  owner_id: string
  property_id: string
  tenant_id: string
  payment_id: string | null
  period_month: number
  period_year: number
  amount: number
  charges: number
  issue_date: string
  file_path: string | null
  sent_at: string | null
  created_at: string
  property?: Property
  tenant?: Tenant
}

export type DocumentType = 'lease' | 'entry_inspection' | 'exit_inspection' | 'inventory'
export type DocumentStatus = 'draft' | 'sent' | 'signed' | 'finalized'

export type Document = {
  id: string
  owner_id: string
  property_id: string
  tenant_id: string | null
  type: DocumentType
  title: string
  status: DocumentStatus
  content: Record<string, unknown> | null
  file_path: string | null
  owner_signature: string | null
  tenant_signature: string | null
  sent_at: string | null
  signed_at: string | null
  created_at: string
  updated_at: string
  property?: Property
  tenant?: Tenant
}
