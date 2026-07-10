-- 019_domain_agents_object_model.sql
-- Episode 6 / Phase 1 — Domain Agents object model + lineage + owner-flexible workspace substrate.
-- Global platform tables: domain_agents, templates, workflows, workflow_steps
--   (all-authenticated SELECT; writes via service_role + private.is_skill_admin()).
-- Founder-owned tables: tasks, workspace_files, freeform_requests (RLS auth.uid() = user_id).
-- Extends artifacts (011) with lineage/provenance + 'domain_agent_task' source_kind.
-- New private storage bucket: workspace. Seeds 5 agents + P&L POC placeholders.

-- ===================== shared updated_at trigger fn =====================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================= GLOBAL TABLES =============================
create table if not exists public.domain_agents (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  discipline_statement text not null,
  what_its_good_at text,
  icon text,
  color text,
  capabilities jsonb not null default '{}'::jsonb,
  thought_starters jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_agents_key_check
    check (key in ('financial','client','operational','team','stewardship'))
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  output_contract jsonb not null default '{}'::jsonb,
  render_spec jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.domain_agents(id) on delete cascade,
  key text unique not null,
  name text not null,
  description text,
  capability text,
  template_id uuid references public.templates(id) on delete set null,
  prereqs jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workflows_agent_id_idx on public.workflows(agent_id);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  position int not null,
  name text not null,
  step_type text not null,
  skill_id uuid references public.skill_packs(id) on delete set null,
  system_prompt_template text,
  tools jsonb not null default '[]'::jsonb,
  capability_key text,
  output_schema jsonb not null default '{}'::jsonb,
  workspace_inputs jsonb not null default '[]'::jsonb,
  workspace_output text,
  batch_size int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_steps_type_check
    check (step_type in ('programmatic','llm_single','llm_agent','llm_batch_agents','llm_human_input')),
  unique (workflow_id, position)
);
create index if not exists workflow_steps_workflow_id_idx on public.workflow_steps(workflow_id);

-- ========================== FOUNDER-OWNED TABLES ==========================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id uuid not null references public.domain_agents(id) on delete cascade,
  workflow_id uuid references public.workflows(id) on delete set null,
  title text,
  status text not null default 'ready',
  current_step int not null default 0,
  step_results jsonb not null default '{}'::jsonb,
  origin text not null default 'profile',
  origin_thread_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_status_check check (status in ('ready','running','blocked','review','done')),
  constraint tasks_origin_check check (origin in ('profile','kanban','vcso'))
);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_status_idx on public.tasks(status);

create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  user_id uuid not null,
  file_path text not null,
  content text,
  storage_path text,
  source text not null default 'agent',
  size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_files_owner_type_check check (owner_type in ('task','thread')),
  constraint workspace_files_source_check check (source in ('agent','sandbox','upload')),
  unique (owner_type, owner_id, file_path)
);
create index if not exists workspace_files_owner_idx on public.workspace_files(owner_type, owner_id);
create index if not exists workspace_files_user_id_idx on public.workspace_files(user_id);

create table if not exists public.freeform_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id uuid not null references public.domain_agents(id) on delete cascade,
  raw_text text not null,
  mapped boolean not null default false,
  mapped_workflow_id uuid references public.workflows(id) on delete set null,
  resulting_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists freeform_requests_user_id_idx on public.freeform_requests(user_id);

-- ============================== updated_at triggers ==============================
drop trigger if exists domain_agents_touch on public.domain_agents;
create trigger domain_agents_touch before update on public.domain_agents
  for each row execute function public.touch_updated_at();
drop trigger if exists templates_touch on public.templates;
create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();
drop trigger if exists workflows_touch on public.workflows;
create trigger workflows_touch before update on public.workflows
  for each row execute function public.touch_updated_at();
drop trigger if exists workflow_steps_touch on public.workflow_steps;
create trigger workflow_steps_touch before update on public.workflow_steps
  for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
drop trigger if exists workspace_files_touch on public.workspace_files;
create trigger workspace_files_touch before update on public.workspace_files
  for each row execute function public.touch_updated_at();

-- ============================== RLS: GLOBAL TABLES ==============================
-- Pattern: all-authenticated SELECT; INSERT/UPDATE/DELETE gated by private.is_skill_admin(); service_role full.
do $$
declare t text;
begin
  foreach t in array array['domain_agents','templates','workflows','workflow_steps'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_select_all', t);
    execute format('create policy %I on public.%I for select to authenticated using (true);', t||'_select_all', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_skill_admin((select auth.uid())));', t||'_admin_insert', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_skill_admin((select auth.uid()))) with check (private.is_skill_admin((select auth.uid())));', t||'_admin_update', t);
    execute format('drop policy if exists %I on public.%I;', t||'_admin_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_skill_admin((select auth.uid())));', t||'_admin_delete', t);
  end loop;
end $$;

-- ============================== RLS: FOUNDER-OWNED TABLES ==============================
-- Pattern mirrors artifacts (011): own-row via auth.uid() = user_id; service_role full.
do $$
declare t text;
begin
  foreach t in array array['tasks','workspace_files','freeform_requests'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id);', t||'_select_own', t);
    execute format('drop policy if exists %I on public.%I;', t||'_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id);', t||'_insert_own', t);
    execute format('drop policy if exists %I on public.%I;', t||'_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);', t||'_update_own', t);
    execute format('drop policy if exists %I on public.%I;', t||'_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id);', t||'_delete_own', t);
  end loop;
end $$;

-- ============================== ALTER artifacts (011) ==============================
alter table public.artifacts drop constraint if exists artifacts_source_kind_check;
alter table public.artifacts add constraint artifacts_source_kind_check
  check (source_kind in ('vcso_thread','domain_agent_task'));
alter table public.artifacts add column if not exists task_id uuid;
alter table public.artifacts add column if not exists workflow_id uuid;
alter table public.artifacts add column if not exists agent_id uuid;
alter table public.artifacts add column if not exists template_id uuid;
alter table public.artifacts add column if not exists provenance jsonb not null default '{}'::jsonb;
alter table public.artifacts add column if not exists promoted_to_kb boolean not null default false;
create index if not exists artifacts_task_id_idx on public.artifacts(task_id);

-- ============================== storage bucket: workspace ==============================
insert into storage.buckets (id, name, public) values ('workspace','workspace',false)
  on conflict (id) do nothing;
drop policy if exists workspace_select_own_folder on storage.objects;
create policy workspace_select_own_folder on storage.objects for select to authenticated
  using (bucket_id='workspace' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists workspace_insert_own_folder on storage.objects;
create policy workspace_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id='workspace' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists workspace_update_own_folder on storage.objects;
create policy workspace_update_own_folder on storage.objects for update to authenticated
  using (bucket_id='workspace' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists workspace_delete_own_folder on storage.objects;
create policy workspace_delete_own_folder on storage.objects for delete to authenticated
  using (bucket_id='workspace' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================== SEED: 5 domain agents (POC) ==============================
insert into public.domain_agents (key, name, discipline_statement, what_its_good_at, icon, color, capabilities, thought_starters) values
 ('financial','Financial',
  'Interprets any financial evidence — P&L, balance sheet, cash flow, budget, forecast. Margin, revenue quality, growth economics, scenario thinking.',
  'Reading financial statements and turning them into a clear assessment.', 'coins', '#B8922A',
  '{"Analyze":["Interpret a P&L"],"Create":["Produce a financial assessment"],"Plan":[]}'::jsonb,
  '["What does my latest P&L say about margin?","Where is my revenue quality strongest and weakest?"]'::jsonb),
 ('client','Client',
  'Client and market. Acquisition, retention, concentration, profitability, positioning, portfolio quality. Absorbs the commercial/sales view.',
  'Reading the client portfolio and market position.', 'users', '#335373',
  '{"Analyze":["Evaluate client concentration"],"Create":[],"Plan":[]}'::jsonb,
  '["How concentrated is my revenue across clients?"]'::jsonb),
 ('operational','Operational',
  'Process, capacity, delivery, workflow, execution, utilization, SOP maturity.',
  'Reading delivery capacity and process maturity.', 'gears', '#5F7EA3',
  '{"Analyze":["Assess utilization"],"Create":[],"Plan":[]}'::jsonb,
  '["Where is delivery capacity constrained?"]'::jsonb),
 ('team','Team',
  'Organizational design, leadership, delegation, accountability, capability.',
  'Reading org health and leadership leverage.', 'sitemap', '#143E43',
  '{"Analyze":["Run a team-health read"],"Create":[],"Plan":[]}'::jsonb,
  '["Where are accountability gaps on the team?"]'::jsonb),
 ('stewardship','Stewardship',
  'The founder''s own role — decision patterns, leverage, strategic focus, and evolution. The natural orchestrator of cross-domain decisions.',
  'Reading founder leverage and strategic focus.', 'compass', '#193052',
  '{"Analyze":["Assess founder leverage"],"Create":[],"Plan":[]}'::jsonb,
  '["Where am I the bottleneck in the business?"]'::jsonb)
on conflict (key) do nothing;

-- ============================== SEED: P&L template + workflow + steps (POC placeholders) ==============================
insert into public.templates (key, name, output_contract, render_spec) values
 ('monthly_pnl_assessment_v1','Monthly P&L Assessment',
  '{"sections":["headline","findings","risks","questions"],"placeholder":true}'::jsonb,
  '{"render":"markdown_to_html","export":"ep4_sandbox","placeholder":true}'::jsonb)
on conflict (key) do nothing;

insert into public.workflows (agent_id, key, name, description, capability, template_id, prereqs)
select da.id, 'produce_monthly_pnl_assessment', 'Produce a Monthly P&L Assessment',
  'Turn recent monthly P&L documents into a structured assessment.', 'Analyze',
  t.id, '{"required":["One or more monthly P&L documents"]}'::jsonb
from public.domain_agents da, public.templates t
where da.key='financial' and t.key='monthly_pnl_assessment_v1'
on conflict (key) do nothing;

insert into public.workflow_steps (workflow_id, position, name, step_type, tools, output_schema, workspace_inputs, workspace_output)
select w.id, v.position, v.name, v.step_type, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, v.workspace_output
from public.workflows w,
 (values
   (1,'Prereq / Intake','programmatic','pnl-source.md'),
   (2,'Clarify Context','llm_human_input','review-context.md'),
   (3,'Analyze P&L','llm_agent','analysis.md'),
   (4,'Synthesize Assessment','llm_single','assessment.md'),
   (5,'Render Artifact','programmatic','artifact.html')
 ) as v(position,name,step_type,workspace_output)
where w.key='produce_monthly_pnl_assessment'
on conflict (workflow_id, position) do nothing;
