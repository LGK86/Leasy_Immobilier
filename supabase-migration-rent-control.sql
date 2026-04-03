-- Nouvelles colonnes sur properties
alter table public.properties
  add column if not exists construction_year integer,
  add column if not exists rental_type text check (rental_type in ('furnished', 'unfurnished')),
  add column if not exists rent_control_status text check (rent_control_status in ('compliant', 'non_compliant', 'not_applicable')),
  add column if not exists rent_control_reference numeric,
  add column if not exists rent_control_max numeric,
  add column if not exists rent_control_min numeric,
  add column if not exists rent_control_checked_at timestamptz;

-- Table pour les données d'encadrement
create table if not exists public.rent_control_zones (
  id uuid default uuid_generate_v4() primary key,
  city text not null,
  zone_id text,
  zone_name text,
  rooms_count integer not null,
  construction_period text not null,
  rental_type text not null check (rental_type in ('furnished', 'unfurnished')),
  ref_price numeric not null,
  max_price numeric not null,
  min_price numeric not null,
  year integer not null,
  created_at timestamptz default now()
);

-- RLS sur rent_control_zones (lecture publique car données gouv)
alter table public.rent_control_zones enable row level security;
create policy "rent_control_zones_select_all" on public.rent_control_zones
  for select using (true);
