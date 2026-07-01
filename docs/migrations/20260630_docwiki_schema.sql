-- ArchitectOS Document Wiki Layer 2 Sub-phase 02: page schema and capability registration.
-- Additive only. No existing OSE checks or constraints are changed.

create extension if not exists vector;

alter table public.ose_knowledge_pages
  add column if not exists embedding           vector(1536),
  add column if not exists origin_thread_id    text,
  add column if not exists synthesis_job_id    text,
  add column if not exists recall_count        integer not null default 0,
  add column if not exists last_recalled_at    timestamptz,
  add column if not exists promotion_state     text    not null default 'default';

comment on column public.ose_knowledge_pages.pinecone_vector_id
  is 'DEPRECATED 2026-06-30: Pinecone is no longer used. pgvector (embedding col) is the page-embedding path. Do not write or read this column in new code.';

create index if not exists ose_knowledge_pages_embedding_idx
  on public.ose_knowledge_pages
  using hnsw (embedding vector_cosine_ops);

create table if not exists public.ose_page_links (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id),
  from_page_id  uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  to_page_id    uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  relation      text,
  created_at    timestamptz not null default now()
);

create unique index if not exists ose_page_links_unique_idx
  on public.ose_page_links (user_id, from_page_id, to_page_id);

alter table public.ose_page_links enable row level security;

drop policy if exists "Users can manage own page links" on public.ose_page_links;
create policy "Users can manage own page links"
  on public.ose_page_links
  for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.agent_capabilities (
  capability_key,
  label,
  description,
  status,
  allowed_surfaces,
  allowed_tools,
  allowed_source_kinds,
  model_setting_key,
  output_schema,
  default_config,
  can_spawn_agents
)
values (
  'per_user_document_wiki',
  'Per-user document wiki',
  'Layer 2 document wiki: emergent per-user pages synthesized from uploaded documents, CSO threads, sprint history, and domain-agent artifacts.',
  'experimental',
  array['virtual_cso', 'os_engine', 'domain_agent', 'sprint_planning'],
  array['docwiki_get_page', 'docwiki_search', 'docwiki_list'],
  array['wiki_page', 'wiki_page_link'],
  'per_user_document_wiki',
  '{"version":"agent_result_v1"}'::jsonb,
  '{"max_sources":8,"max_rounds":1,"timeout_seconds":20}'::jsonb,
  false
)
on conflict (capability_key) do update
set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  allowed_surfaces = excluded.allowed_surfaces,
  allowed_tools = excluded.allowed_tools,
  allowed_source_kinds = excluded.allowed_source_kinds,
  model_setting_key = excluded.model_setting_key,
  output_schema = excluded.output_schema,
  default_config = excluded.default_config,
  can_spawn_agents = false,
  updated_at = now();
