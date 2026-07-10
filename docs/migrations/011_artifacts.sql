-- Phase 6: founder-owned sandbox-generated artifacts.

insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do nothing;

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_kind text not null,
  source_id uuid,
  filename text not null,
  mime_type text,
  size bigint,
  storage_path text not null,
  renderable boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artifacts_source_kind_check
    check (source_kind in ('vcso_thread'))
);

create index if not exists artifacts_user_id_idx
  on public.artifacts(user_id);
create index if not exists artifacts_source_idx
  on public.artifacts(source_kind, source_id);

create or replace function public.update_artifacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists artifacts_updated_at_trigger on public.artifacts;
create trigger artifacts_updated_at_trigger
  before update on public.artifacts
  for each row
  execute function public.update_artifacts_updated_at();

alter table public.artifacts enable row level security;

grant select, insert, update, delete on public.artifacts to authenticated;
grant all on public.artifacts to service_role;

drop policy if exists artifacts_select_own on public.artifacts;
create policy artifacts_select_own
  on public.artifacts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists artifacts_insert_own on public.artifacts;
create policy artifacts_insert_own
  on public.artifacts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists artifacts_update_own on public.artifacts;
create policy artifacts_update_own
  on public.artifacts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists artifacts_delete_own on public.artifacts;
create policy artifacts_delete_own
  on public.artifacts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists artifacts_select_own_folder on storage.objects;
create policy artifacts_select_own_folder
  on storage.objects for select
  to authenticated
  using (bucket_id = 'artifacts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists artifacts_insert_own_folder on storage.objects;
create policy artifacts_insert_own_folder
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'artifacts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists artifacts_delete_own_folder on storage.objects;
create policy artifacts_delete_own_folder
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'artifacts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Rollback:
-- drop policy if exists artifacts_select_own_folder on storage.objects;
-- drop policy if exists artifacts_insert_own_folder on storage.objects;
-- drop policy if exists artifacts_delete_own_folder on storage.objects;
-- drop table if exists public.artifacts cascade;
-- drop function if exists public.update_artifacts_updated_at cascade;
-- delete from storage.buckets where id = 'artifacts';
