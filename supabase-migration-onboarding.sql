-- Migration : Parcours d'onboarding
-- Date : 2026-04-01
-- À exécuter dans le SQL Editor Supabase

alter table public.profiles
  add column if not exists onboarding_completed boolean default false,
  add column if not exists onboarding_step integer default 0;
