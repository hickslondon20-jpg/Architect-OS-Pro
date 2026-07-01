-- ArchitectOS Doc Wiki (Layer 2) - Corrections and Activity Log Tables
-- Migration: 20260630_docwiki_corrections_log
--
-- These tables were created during sub-phase 03 development (2026-06-30).
-- Both exist in the live Supabase project. This migration documents the
-- schema so it can be reproduced from migrations/ if needed.
-- Safe to apply: uses CREATE TABLE IF NOT EXISTS throughout.

-- -----------------------------------------------------------------------
-- ose_page_corrections
-- Stores founder corrections (overrides) for synthesized wiki pages.
-- status='pending'  -> correction written, not yet incorporated into synthesis
-- status='applied'  -> correction has been included in a re-synthesis pass
-- -----------------------------------------------------------------------
create table if not exists public.ose_page_corrections (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  page_id    uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  body       text        not null,
  status     text        not null default 'pending',
  created_at timestamptz not null default now(),
  constraint ose_page_corrections_status_check
    check (status in ('pending', 'applied'))
);

create index if not exists ose_page_corrections_user_id_idx
  on public.ose_page_corrections(user_id);

create index if not exists ose_page_corrections_page_id_status_idx
  on public.ose_page_corrections(page_id, status);

alter table public.ose_page_corrections enable row level security;

-- Founders read/write their own corrections only
create policy if not exists "Users manage their own page corrections"
  on public.ose_page_corrections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- -----------------------------------------------------------------------
-- ose_activity_log
-- Chronological feed of synthesis events and strategic decisions.
-- kind='activity' -> routine synthesis events (SYNTHESIS_COMPLETE, MANIFEST_UPDATE)
-- kind='decision' -> flagged decisions (CONTRADICTION_FLAGGED, CORRECTIONS_APPLIED, etc.)
-- icon            -> kebab-case Lucide icon name ('file-text', 'alert-triangle', 'x-circle')
-- -----------------------------------------------------------------------
create table if not exists public.ose_activity_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null default 'activity',
  text       text        not null,
  icon       text,
  created_at timestamptz not null default now(),
  constraint ose_activity_log_kind_check
    check (kind in ('activity', 'decision'))
);

create index if not exists ose_activity_log_user_id_created_idx
  on public.ose_activity_log(user_id, created_at desc);

alter table public.ose_activity_log enable row level security;

-- Founders read their own log only
create policy if not exists "Users read their own activity log"
  on public.ose_activity_log
  for select
  using (auth.uid() = user_id);

-- Service role writes log entries (synthesis engine writes via service role key)
create policy if not exists "Service role writes activity log"
  on public.ose_activity_log
  for insert
  to service_role
  with check (true);
