-- 022_vcso_deep_mode.sql
-- Episode 6 / Phase 6 - Virtual CSO Deep Mode.
-- Thread-scoped editable todos + per-message deep-mode flag + thread-side pause/resume state.

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.agent_todos (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.vcso_chat_threads(id) on delete cascade,
  user_id uuid not null,
  content text not null,
  status text not null default 'pending',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_todos_status_check check (status in ('pending','in_progress','completed')),
  unique (thread_id, position)
);

create index if not exists agent_todos_thread_id_idx on public.agent_todos(thread_id);
create index if not exists agent_todos_user_id_idx on public.agent_todos(user_id);

drop trigger if exists agent_todos_touch on public.agent_todos;
create trigger agent_todos_touch before update on public.agent_todos
  for each row execute function public.touch_updated_at();

alter table public.agent_todos enable row level security;
grant select, insert, update, delete on public.agent_todos to authenticated;
grant all on public.agent_todos to service_role;

drop policy if exists agent_todos_select_own on public.agent_todos;
create policy agent_todos_select_own on public.agent_todos for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists agent_todos_insert_own on public.agent_todos;
create policy agent_todos_insert_own on public.agent_todos for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists agent_todos_update_own on public.agent_todos;
create policy agent_todos_update_own on public.agent_todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists agent_todos_delete_own on public.agent_todos;
create policy agent_todos_delete_own on public.agent_todos for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.vcso_chat_messages
  add column if not exists deep_mode boolean not null default false;

alter table public.vcso_chat_threads
  add column if not exists agent_status text not null default 'complete',
  add column if not exists deep_resume_state jsonb;

alter table public.vcso_chat_threads drop constraint if exists vcso_chat_threads_agent_status_check;
alter table public.vcso_chat_threads add constraint vcso_chat_threads_agent_status_check
  check (agent_status in ('working','waiting_for_user','complete','error'));
