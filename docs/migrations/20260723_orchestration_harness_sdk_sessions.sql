-- 04B Phase E — founder-scoped Claude Agent SDK session persistence.
-- Raw SDK transcript entries stay outside every exposed API schema.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.vcso_sdk_session_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.vcso_chat_threads(id) on delete cascade,
  turn_message_id uuid not null references public.vcso_chat_messages(id) on delete cascade,
  project_key text not null,
  session_id uuid not null,
  subpath text not null default '',
  entry_uuid text,
  entry jsonb not null,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  constraint vcso_sdk_session_entries_project_key_check
    check (length(project_key) between 1 and 240),
  constraint vcso_sdk_session_entries_subpath_check
    check (length(subpath) <= 500),
  constraint vcso_sdk_session_entries_payload_check
    check (jsonb_typeof(entry) = 'object')
);

create index if not exists vcso_sdk_session_entries_load_idx
  on private.vcso_sdk_session_entries(user_id, project_key, session_id, subpath, id);

create index if not exists vcso_sdk_session_entries_thread_idx
  on private.vcso_sdk_session_entries(user_id, thread_id, created_at);

create index if not exists vcso_sdk_session_entries_expiry_idx
  on private.vcso_sdk_session_entries(expires_at);

create unique index if not exists vcso_sdk_session_entries_uuid_uq
  on private.vcso_sdk_session_entries(user_id, project_key, session_id, subpath, entry_uuid)
  where entry_uuid is not null;

alter table private.vcso_sdk_session_entries enable row level security;
alter table private.vcso_sdk_session_entries force row level security;

revoke all on private.vcso_sdk_session_entries from public, anon, authenticated;
grant select, insert, update, delete on private.vcso_sdk_session_entries to service_role;
grant usage, select on sequence private.vcso_sdk_session_entries_id_seq to service_role;

alter table public.vcso_chat_threads
  add column if not exists active_sdk_session_id uuid,
  add column if not exists sdk_pending_tool_use_id text,
  add column if not exists sdk_pending_question text,
  add column if not exists sdk_pending_run_id uuid references public.agent_delegation_runs(id) on delete set null,
  add column if not exists sdk_session_updated_at timestamptz;

create index if not exists vcso_chat_threads_active_sdk_session_idx
  on public.vcso_chat_threads(user_id, active_sdk_session_id)
  where active_sdk_session_id is not null;

create or replace function public.vcso_sdk_session_append(
  p_user_id uuid,
  p_thread_id uuid,
  p_turn_message_id uuid,
  p_project_key text,
  p_session_id uuid,
  p_subpath text,
  p_entries jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if p_user_id is null
     or p_thread_id is null
     or p_turn_message_id is null
     or p_session_id is null
     or nullif(btrim(p_project_key), '') is null then
    raise exception 'SDK session append requires founder, thread, message, project, and session identifiers';
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'SDK session append entries must be a JSON array';
  end if;

  if not exists (
    select 1
    from public.vcso_chat_threads t
    where t.id = p_thread_id
      and t.user_id = p_user_id
  ) then
    raise exception 'SDK session thread ownership check failed';
  end if;

  if not exists (
    select 1
    from public.vcso_chat_messages m
    where m.id = p_turn_message_id
      and m.thread_id = p_thread_id
      and m.user_id = p_user_id
      and m.deep_mode is true
  ) then
    raise exception 'SDK session turn ownership or Deep Mode check failed';
  end if;

  -- Sliding retention: activity renews the whole session so a live session
  -- never loses its older prefix while dormant sessions expire after 90 days.
  update private.vcso_sdk_session_entries e
  set expires_at = now() + interval '90 days'
  where e.user_id = p_user_id
    and e.project_key = p_project_key
    and e.session_id = p_session_id;

  insert into private.vcso_sdk_session_entries (
    user_id,
    thread_id,
    turn_message_id,
    project_key,
    session_id,
    subpath,
    entry_uuid,
    entry,
    expires_at
  )
  select
    p_user_id,
    p_thread_id,
    p_turn_message_id,
    p_project_key,
    p_session_id,
    coalesce(p_subpath, ''),
    nullif(item.entry ->> 'uuid', ''),
    item.entry,
    now() + interval '90 days'
  from jsonb_array_elements(p_entries) with ordinality as item(entry, ordinal)
  order by item.ordinal
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.vcso_sdk_session_load(
  p_user_id uuid,
  p_project_key text,
  p_session_id uuid,
  p_subpath text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(e.entry order by e.id), '[]'::jsonb)
  from private.vcso_sdk_session_entries e
  where e.user_id = p_user_id
    and e.project_key = p_project_key
    and e.session_id = p_session_id
    and e.subpath = coalesce(p_subpath, '')
    and e.expires_at > now();
$$;

create or replace function public.vcso_sdk_session_list_subkeys(
  p_user_id uuid,
  p_project_key text,
  p_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(subpaths.subpath order by subpaths.subpath), '[]'::jsonb)
  from (
    select distinct e.subpath
    from private.vcso_sdk_session_entries e
    where e.user_id = p_user_id
      and e.project_key = p_project_key
      and e.session_id = p_session_id
      and e.subpath <> ''
      and e.expires_at > now()
  ) subpaths;
$$;

create or replace function private.prune_vcso_sdk_session_entries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  delete from private.vcso_sdk_session_entries
  where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.vcso_sdk_session_append(uuid, uuid, uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.vcso_sdk_session_load(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.vcso_sdk_session_list_subkeys(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function private.prune_vcso_sdk_session_entries()
  from public, anon, authenticated;

grant execute on function public.vcso_sdk_session_append(uuid, uuid, uuid, text, uuid, text, jsonb)
  to service_role;
grant execute on function public.vcso_sdk_session_load(uuid, text, uuid, text)
  to service_role;
grant execute on function public.vcso_sdk_session_list_subkeys(uuid, text, uuid)
  to service_role;
grant execute on function private.prune_vcso_sdk_session_entries()
  to service_role;

select cron.schedule(
  'vcso-sdk-session-retention',
  '17 3 * * *',
  $cron$select private.prune_vcso_sdk_session_entries();$cron$
);

comment on table private.vcso_sdk_session_entries is
  'Backend-only, founder-scoped Claude Agent SDK transcript entries for model-driven VCSO Deep Mode. Sliding 90-day TTL.';
comment on column public.vcso_chat_threads.active_sdk_session_id is
  'Active SDK continuation for model-driven Deep Mode. Never used by the legacy deep_resume_state fallback.';

