-- Orchestration Harness Phase 1 / Plan 01-02
-- Durable, founder-scoped agent notes for reusable resources. Not a KB write.

create table if not exists public.agent_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('wiki_component', 'tool', 'skill')),
  resource_ref text not null check (char_length(resource_ref) between 1 and 240),
  note text not null check (char_length(note) between 1 and 2000),
  created_by text not null check (char_length(created_by) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_annotations_resource_idx
  on public.agent_annotations(user_id, resource_kind, resource_ref, status, created_at desc);

alter table public.agent_annotations enable row level security;

grant select, insert, update, delete on public.agent_annotations to authenticated;
grant all on public.agent_annotations to service_role;

drop policy if exists agent_annotations_select_own on public.agent_annotations;
create policy agent_annotations_select_own on public.agent_annotations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists agent_annotations_insert_own on public.agent_annotations;
create policy agent_annotations_insert_own on public.agent_annotations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists agent_annotations_update_own on public.agent_annotations;
create policy agent_annotations_update_own on public.agent_annotations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists agent_annotations_delete_own on public.agent_annotations;
create policy agent_annotations_delete_own on public.agent_annotations for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists agent_annotations_touch on public.agent_annotations;
create trigger agent_annotations_touch before update on public.agent_annotations
  for each row execute function public.touch_updated_at();

-- Bound active re-injection cost at eight notes per founder/resource. The trigger
-- clears older rows instead of deleting history.
create or replace function public.cap_agent_annotations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' then
    update public.agent_annotations
       set status = 'cleared', updated_at = now()
     where id in (
       select id
         from public.agent_annotations
        where user_id = new.user_id
          and resource_kind = new.resource_kind
          and resource_ref = new.resource_ref
          and status = 'active'
          and id not in (
            select keep.id
              from public.agent_annotations keep
             where keep.user_id = new.user_id
               and keep.resource_kind = new.resource_kind
               and keep.resource_ref = new.resource_ref
               and keep.status = 'active'
             order by keep.created_at desc, keep.id desc
             limit 8
          )
     );
  end if;
  return new;
end;
$$;

drop trigger if exists agent_annotations_cap on public.agent_annotations;
create trigger agent_annotations_cap after insert or update of status on public.agent_annotations
  for each row execute function public.cap_agent_annotations();

revoke all on function public.cap_agent_annotations() from public, anon, authenticated;
grant execute on function public.cap_agent_annotations() to service_role;

insert into public.tool_registry (
  slug, label, description, tool_type, source_ref, enabled, routing_tier, is_code_registered, last_synced_at
)
values (
  'annotate',
  'Annotate Resource',
  'Attach or clear a bounded founder-scoped note on a wiki component, tool, or skill.',
  'native',
  '{"kind":"native"}'::jsonb,
  true,
  null,
  true,
  now()
)
on conflict (slug) do update
set label = excluded.label,
    description = excluded.description,
    tool_type = excluded.tool_type,
    source_ref = excluded.source_ref,
    is_code_registered = true,
    last_synced_at = now(),
    updated_at = now();
