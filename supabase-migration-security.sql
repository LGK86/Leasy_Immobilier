-- Migration : Politiques RLS explicites par opération
-- Date : 2026-04-01
-- À exécuter dans le SQL Editor Supabase
-- Remplace les politiques "for all" par des politiques séparées SELECT/INSERT/UPDATE/DELETE

-- ============================================================
-- properties
-- ============================================================
drop policy if exists "Users can manage their own properties" on public.properties;

create policy "properties_select" on public.properties
  for select using (auth.uid() = owner_id);

create policy "properties_insert" on public.properties
  for insert with check (auth.uid() = owner_id);

create policy "properties_update" on public.properties
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "properties_delete" on public.properties
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- tenants
-- ============================================================
drop policy if exists "Users can manage their own tenants" on public.tenants;

create policy "tenants_select" on public.tenants
  for select using (auth.uid() = owner_id);

create policy "tenants_insert" on public.tenants
  for insert with check (auth.uid() = owner_id);

create policy "tenants_update" on public.tenants
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "tenants_delete" on public.tenants
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- rent_payments
-- ============================================================
drop policy if exists "Users can manage their own payments" on public.rent_payments;

create policy "rent_payments_select" on public.rent_payments
  for select using (auth.uid() = owner_id);

create policy "rent_payments_insert" on public.rent_payments
  for insert with check (auth.uid() = owner_id);

create policy "rent_payments_update" on public.rent_payments
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "rent_payments_delete" on public.rent_payments
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- rent_receipts
-- ============================================================
drop policy if exists "Users can manage their own receipts" on public.rent_receipts;

create policy "rent_receipts_select" on public.rent_receipts
  for select using (auth.uid() = owner_id);

create policy "rent_receipts_insert" on public.rent_receipts
  for insert with check (auth.uid() = owner_id);

create policy "rent_receipts_update" on public.rent_receipts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "rent_receipts_delete" on public.rent_receipts
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- documents
-- ============================================================
drop policy if exists "Users can manage their own documents" on public.documents;

-- Documents: SELECT also allows tenant signing (token-based, no owner_id check needed at RLS level)
create policy "documents_select" on public.documents
  for select using (auth.uid() = owner_id);

create policy "documents_insert" on public.documents
  for insert with check (auth.uid() = owner_id);

create policy "documents_update" on public.documents
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "documents_delete" on public.documents
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- notifications (if table exists)
-- ============================================================
drop policy if exists "Users can manage their own notifications" on public.notifications;

create policy "notifications_select" on public.notifications
  for select using (auth.uid() = owner_id);

create policy "notifications_insert" on public.notifications
  for insert with check (auth.uid() = owner_id);

create policy "notifications_update" on public.notifications
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "notifications_delete" on public.notifications
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- profiles (already has separate policies — verify/complete)
-- ============================================================
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No DELETE on profiles (intentional — account deletion handled via admin API)

-- ============================================================
-- Storage : bucket documents
-- ============================================================
drop policy if exists "Users can manage their own files" on storage.objects;

create policy "storage_select" on storage.objects
  for select using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_update" on storage.objects
  for update using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_delete" on storage.objects
  for delete using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
