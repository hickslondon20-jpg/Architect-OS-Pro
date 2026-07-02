-- Phase 5: sandbox session registry for GKE-hosted interactive execution.

create table if not exists public.sandbox_sessions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.vcso_chat_threads(id) on delete cascade,
  pod_name text not null,
  kube_namespace text not null default 'default',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  constraint sandbox_sessions_status_check
    check (status in ('active', 'closed', 'expired'))
);

create index if not exists sandbox_sessions_thread_id_idx
  on public.sandbox_sessions(thread_id);
create index if not exists sandbox_sessions_status_idx
  on public.sandbox_sessions(status)
  where status = 'active';
create index if not exists sandbox_sessions_last_active_idx
  on public.sandbox_sessions(last_active_at)
  where status = 'active';

alter table public.sandbox_sessions enable row level security;

revoke all on public.sandbox_sessions from anon, authenticated;
grant select, insert, update, delete on public.sandbox_sessions to service_role;
