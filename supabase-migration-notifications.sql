-- Ajouter les préférences de notifications email dans profiles
alter table public.profiles
  add column if not exists notif_email_document_signed boolean default true,
  add column if not exists notif_email_document_finalized boolean default true,
  add column if not exists notif_email_payment_received boolean default true,
  add column if not exists notif_email_receipt_generated boolean default false;

-- Ajouter les préférences de notifications in-app dans profiles
alter table public.profiles
  add column if not exists notif_app_document_signed boolean default true,
  add column if not exists notif_app_document_finalized boolean default true,
  add column if not exists notif_app_payment_received boolean default true,
  add column if not exists notif_app_receipt_generated boolean default true;
