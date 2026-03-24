-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (propriétaires)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- PROPERTIES (biens immobiliers)
create table if not exists public.properties (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  address text not null,
  city text not null,
  postal_code text not null,
  type text check (type in ('apartment','house','studio','commercial','other')) default 'apartment',
  monthly_rent numeric(10,2) not null default 0,
  charges numeric(10,2) not null default 0,
  deposit numeric(10,2) not null default 0,
  status text check (status in ('rented','vacant')) default 'vacant',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.properties enable row level security;

create policy "Owners can manage own properties"
  on public.properties for all
  using (auth.uid() = owner_id);

-- TENANTS (locataires)
create table if not exists public.tenants (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  entry_date date,
  lease_end_date date,
  status text default 'active' check (status in ('active', 'inactive')),
  tacite_reconduction boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tenants enable row level security;

create policy "Owners can manage own tenants"
  on public.tenants for all
  using (auth.uid() = owner_id);

-- RENT PAYMENTS (paiements de loyer)
create table if not exists public.rent_payments (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  amount numeric(10,2) not null,
  charges numeric(10,2) not null default 0,
  payment_date date,
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null,
  status text check (status in ('received','pending_validation','late','paid','pending')) default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.rent_payments enable row level security;

create policy "Owners can manage own payments"
  on public.rent_payments for all
  using (auth.uid() = owner_id);

-- RENT RECEIPTS (quittances)
create table if not exists public.rent_receipts (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  payment_id uuid references public.rent_payments(id) on delete set null,
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null,
  amount numeric(10,2) not null,
  charges numeric(10,2) not null default 0,
  issue_date date not null default current_date,
  file_path text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.rent_receipts enable row level security;

create policy "Owners can manage own receipts"
  on public.rent_receipts for all
  using (auth.uid() = owner_id);

-- DOCUMENTS (bail, état des lieux, inventaire)
create table if not exists public.documents (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  type text check (type in ('lease','entry_inspection','exit_inspection','inventory')) not null,
  title text not null,
  status text check (status in ('draft','sent','signed','finalized')) default 'draft',
  content jsonb,
  file_path text,
  owner_signature text,
  tenant_signature text,
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.documents enable row level security;

create policy "Owners can manage own documents"
  on public.documents for all
  using (auth.uid() = owner_id);

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Owners can manage own files"
  on storage.objects for all
  using (auth.uid()::text = (storage.foldername(name))[1]);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Owners can manage own notifications"
  on public.notifications for all
  using (auth.uid() = owner_id);
