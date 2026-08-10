-- 04B Phase E - SDK session persistence now runs on the native single path.
-- Deep Mode was removed in Step 1.5, so append authorization must be based on
-- founder/thread/message ownership rather than the deleted message-mode flag.

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
  ) then
    raise exception 'SDK session turn ownership check failed';
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

revoke all on function public.vcso_sdk_session_append(uuid, uuid, uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.vcso_sdk_session_append(uuid, uuid, uuid, text, uuid, text, jsonb)
  to service_role;
