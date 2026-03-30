-- Migration: ajout surface et rooms_count a la table properties
-- Date: 2026-03-30

alter table public.properties
  add column if not exists surface numeric(6,2),
  add column if not exists rooms_count integer;
