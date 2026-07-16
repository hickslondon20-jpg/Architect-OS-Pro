-- 04B Phase C: additive registry semantics + lean QuickBooks pilot availability.
-- No feature flag is flipped and ai_usage_log is intentionally untouched.

alter table public.tool_registry
  add column if not exists persistence_semantics text not null default 'read_only';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tool_registry'::regclass
      and conname = 'tool_registry_persistence_semantics_check'
  ) then
    alter table public.tool_registry
      add constraint tool_registry_persistence_semantics_check
      check (persistence_semantics in ('read_only', 'persist_artifact', 'write_external', 'privileged'));
  end if;
end
$$;

update public.tool_registry
set persistence_semantics = case
  when slug in ('execute_code', 'delegate_to_sub_agent', 'task') then 'privileged'
  when slug in ('annotate', 'write_todos', 'write_file', 'edit_file') then 'persist_artifact'
  when tool_type = 'mcp' and lower(coalesce(source_ref ->> 'read_only', 'true')) = 'false' then 'write_external'
  else 'read_only'
end;

comment on column public.tool_registry.persistence_semantics is
  'SDK execution guardrail: read_only, persist_artifact, write_external, or privileged.';

insert into public.feature_registry (
  key,
  label,
  description,
  category,
  beta_unlock_week,
  is_active,
  sort_order
)
values (
  'connector_quickbooks',
  'QuickBooks connector',
  'Founder-scoped availability gate for the read-only QuickBooks MCP pilot.',
  'pro',
  12,
  true,
  180
)
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  beta_unlock_week = excluded.beta_unlock_week,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
