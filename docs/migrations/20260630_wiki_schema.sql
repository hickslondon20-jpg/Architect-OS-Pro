-- ArchitectOS Wiki System Sub-phase 03: schema foundation.
-- The claim/evidence/digest shapes match the frozen wiki-1.0 contract.

create extension if not exists vector;

create table if not exists public.wiki_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_key text not null,
  title text not null,
  one_line text,
  page_kind text not null,
  wiki_version text not null,
  last_compiled_at timestamptz,
  stale boolean not null default false,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_pages_page_kind_check
    check (page_kind in ('compiled_base_only', 'insight_accreting')),
  constraint wiki_pages_version_check
    check (wiki_version = 'wiki-1.0'),
  constraint wiki_pages_page_key_check
    check (page_key in (
      'business_context',
      'diagnostic_synthesis',
      'current_quarter_sprint',
      'growth_constraints',
      'financial_context',
      'client_market_position',
      'open_questions'
    )),
  constraint wiki_pages_user_page_key_unique unique (user_id, page_key),
  constraint wiki_pages_id_user_unique unique (id, user_id)
);

create table if not exists public.wiki_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id uuid not null,
  page_key text not null,
  text text not null,
  class text not null,
  status text not null,
  confidence text not null default 'medium',
  recall_score real not null default 0,
  embedding vector(1536),
  superseded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_claims_page_fk
    foreign key (page_id, user_id) references public.wiki_pages(id, user_id) on delete cascade,
  constraint wiki_claims_superseded_by_fk
    foreign key (superseded_by, user_id) references public.wiki_claims(id, user_id),
  constraint wiki_claims_class_check
    check (class in ('compiled', 'insight', 'override')),
  constraint wiki_claims_status_check
    check (status in ('active', 'quarantined', 'trusted', 'contested', 'retired')),
  constraint wiki_claims_confidence_check
    check (confidence in ('high', 'medium', 'low')),
  constraint wiki_claims_page_key_check
    check (page_key in (
      'business_context',
      'diagnostic_synthesis',
      'current_quarter_sprint',
      'growth_constraints',
      'financial_context',
      'client_market_position',
      'open_questions'
    )),
  constraint wiki_claims_id_user_unique unique (id, user_id)
);

create table if not exists public.wiki_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null,
  source_id text not null,
  source_kind text not null,
  path text not null,
  lines int4range,
  weight real not null default 1.0,
  note text not null default '',
  constraint wiki_evidence_claim_fk
    foreign key (claim_id, user_id) references public.wiki_claims(id, user_id) on delete cascade,
  constraint wiki_evidence_source_kind_check
    check (source_kind in ('raw_document', 'document_chunk', 'tier0_record', 'global_checkpoint'))
);

create table if not exists public.wiki_contradictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null,
  against_claim_id uuid,
  against_page_ref text,
  note text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint wiki_contradictions_claim_fk
    foreign key (claim_id, user_id) references public.wiki_claims(id, user_id) on delete cascade,
  constraint wiki_contradictions_against_claim_fk
    foreign key (against_claim_id, user_id) references public.wiki_claims(id, user_id),
  constraint wiki_contradictions_target_check
    check (against_claim_id is not null or against_page_ref is not null)
);

create table if not exists public.wiki_insight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid,
  trust_state text not null default 'quarantined',
  origin text not null,
  novelty_ok boolean,
  about_business_ok boolean,
  confidence_bar_ok boolean,
  recall_count integer not null default 0,
  query_diversity real not null default 0,
  safe_to_act_after timestamptz,
  expires_at timestamptz,
  authority_owner text,
  avoid_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_insight_records_claim_fk
    foreign key (claim_id, user_id) references public.wiki_claims(id, user_id) on delete cascade,
  constraint wiki_insight_records_trust_state_check
    check (trust_state in ('quarantined', 'promotion_candidate', 'trusted', 'rejected')),
  constraint wiki_insight_records_origin_check
    check (origin in ('domain_agent_writeback', 'dreaming'))
);

create table if not exists public.wiki_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  actor text not null,
  page_key text,
  claim_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wiki_action_log_claim_fk
    foreign key (claim_id, user_id) references public.wiki_claims(id, user_id),
  constraint wiki_action_log_action_check
    check (action in (
      'compile',
      'propose_insight',
      'set_confidence',
      'flag_contradiction',
      'add_override',
      'promote',
      'demote',
      'retire',
      'consolidate'
    )),
  constraint wiki_action_log_actor_check
    check (actor in ('compilation_service', 'domain_agent', 'founder', 'dreaming'))
);

create table if not exists public.wiki_digest (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wiki_version text not null,
  generated_at timestamptz not null default now(),
  digest jsonb not null,
  constraint wiki_digest_version_check
    check (wiki_version = 'wiki-1.0')
);

create table if not exists public.global_ip_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  domain text,
  ladder_stage integer,
  revenue_tier text,
  topic text[],
  version text not null,
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  constraint global_ip_pages_ladder_stage_check
    check (ladder_stage is null or ladder_stage between 1 and 5)
);

comment on column public.global_ip_pages.ladder_stage is
  'AE Ladder stage 1..5 (Rising, Striving, Thriving, Driving, Arriving). Schema models all 5; authored/calibrated content currently covers stages 1-4, with stage 5 a known content gap.';
comment on table public.global_ip_pages is
  'Authored global IP pages only. The GM checkpoint family is not recreated here; read GM checkpoints via gm_checkpoints + gm_audit_questions/gm_checkpoint_stage_meaning/gm_checkpoint_scoring using the ae_frontend_stage_id to gm_stages.stage_id join, and cite them as source_kind=global_checkpoint.';

create table if not exists public.wiki_schema (
  wiki_schema_version text primary key,
  schema jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wiki_schema_version_check
    check (wiki_schema_version = 'wiki-1.0')
);

create index if not exists wiki_claims_lookup_idx
  on public.wiki_claims(user_id, page_key, class, status);
create index if not exists wiki_evidence_claim_idx
  on public.wiki_evidence(user_id, claim_id);
create index if not exists wiki_contradictions_claim_idx
  on public.wiki_contradictions(user_id, claim_id);
create index if not exists wiki_insight_records_user_trust_idx
  on public.wiki_insight_records(user_id, trust_state, updated_at desc);
create index if not exists wiki_action_log_user_created_idx
  on public.wiki_action_log(user_id, created_at desc);
create index if not exists global_ip_pages_selector_idx
  on public.global_ip_pages(domain, ladder_stage, revenue_tier);

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'wiki_pages_embedding_idx'
  ) then
    create index wiki_pages_embedding_idx
      on public.wiki_pages using hnsw (embedding vector_cosine_ops);
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'wiki_claims_embedding_idx'
  ) then
    create index wiki_claims_embedding_idx
      on public.wiki_claims using hnsw (embedding vector_cosine_ops);
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'global_ip_pages_embedding_idx'
  ) then
    create index global_ip_pages_embedding_idx
      on public.global_ip_pages using hnsw (embedding vector_cosine_ops);
  end if;
end $$;

create or replace function public.update_wiki_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists wiki_pages_updated_at_trigger on public.wiki_pages;
create trigger wiki_pages_updated_at_trigger
  before update on public.wiki_pages
  for each row
  execute function public.update_wiki_updated_at();

drop trigger if exists wiki_claims_updated_at_trigger on public.wiki_claims;
create trigger wiki_claims_updated_at_trigger
  before update on public.wiki_claims
  for each row
  execute function public.update_wiki_updated_at();

drop trigger if exists wiki_insight_records_updated_at_trigger on public.wiki_insight_records;
create trigger wiki_insight_records_updated_at_trigger
  before update on public.wiki_insight_records
  for each row
  execute function public.update_wiki_updated_at();

drop trigger if exists wiki_schema_updated_at_trigger on public.wiki_schema;
create trigger wiki_schema_updated_at_trigger
  before update on public.wiki_schema
  for each row
  execute function public.update_wiki_updated_at();

create or replace function public.enforce_wiki_compiled_claim_writer()
returns trigger as $$
begin
  if new.class = 'compiled'
    and (
      coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
      or coalesce(current_setting('app.wiki_compilation_service', true), '') <> 'on'
    )
  then
    raise exception
      'wiki_claims class=compiled is write-locked to the compilation service'
      using errcode = '42501';
  end if;

  return new;
end;
$$ language plpgsql;

comment on function public.enforce_wiki_compiled_claim_writer() is
  'Compiled-base write lock: class=compiled inserts/updates require both the Supabase service_role JWT claim and a transaction-local marker set by the guarded compilation path: select set_config(''app.wiki_compilation_service'', ''on'', true). Founder JWTs and agent write-back paths cannot satisfy both checks.';

drop trigger if exists wiki_claims_compiled_writer_trigger on public.wiki_claims;
create trigger wiki_claims_compiled_writer_trigger
  before insert or update on public.wiki_claims
  for each row
  execute function public.enforce_wiki_compiled_claim_writer();

create or replace function public.replace_compiled_wiki_page(
  p_user_id uuid,
  p_page_key text,
  p_title text,
  p_page_kind text,
  p_one_line text,
  p_page_embedding jsonb,
  p_claims jsonb,
  p_digest jsonb
)
returns void as $$
declare
  v_page_id uuid;
  v_claim jsonb;
  v_evidence jsonb;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('app.wiki_compilation_service', 'on', true);

  insert into public.wiki_pages (
    user_id,
    page_key,
    title,
    one_line,
    page_kind,
    wiki_version,
    last_compiled_at,
    stale,
    embedding
  )
  values (
    p_user_id,
    p_page_key,
    p_title,
    p_one_line,
    p_page_kind,
    'wiki-1.0',
    now(),
    false,
    (p_page_embedding::text)::vector
  )
  on conflict (user_id, page_key) do update
  set title = excluded.title,
      one_line = excluded.one_line,
      page_kind = excluded.page_kind,
      wiki_version = excluded.wiki_version,
      last_compiled_at = excluded.last_compiled_at,
      stale = false,
      embedding = excluded.embedding
  returning id into v_page_id;

  delete from public.wiki_claims
  where user_id = p_user_id
    and page_key = p_page_key
    and class = 'compiled';

  for v_claim in select * from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb))
  loop
    insert into public.wiki_claims (
      id,
      user_id,
      page_id,
      page_key,
      text,
      class,
      status,
      confidence,
      recall_score,
      embedding
    )
    values (
      (v_claim->>'id')::uuid,
      p_user_id,
      v_page_id,
      p_page_key,
      v_claim->>'text',
      'compiled',
      coalesce(v_claim->>'status', 'active'),
      coalesce(v_claim->>'confidence', 'medium'),
      coalesce((v_claim->>'recall_score')::real, 0),
      ((v_claim->'embedding')::text)::vector
    );

    for v_evidence in select * from jsonb_array_elements(coalesce(v_claim->'evidence', '[]'::jsonb))
    loop
      insert into public.wiki_evidence (
        user_id,
        claim_id,
        source_id,
        source_kind,
        path,
        lines,
        weight,
        note
      )
      values (
        p_user_id,
        (v_claim->>'id')::uuid,
        v_evidence->>'source_id',
        v_evidence->>'source_kind',
        v_evidence->>'path',
        null,
        coalesce((v_evidence->>'weight')::real, 1.0),
        coalesce(v_evidence->>'note', '')
      );
    end loop;
  end loop;

  insert into public.wiki_action_log (
    user_id,
    action,
    actor,
    page_key,
    payload
  )
  values (
    p_user_id,
    'compile',
    'compilation_service',
    p_page_key,
    jsonb_build_object(
      'claim_count', jsonb_array_length(coalesce(p_claims, '[]'::jsonb)),
      'thin', jsonb_array_length(coalesce(p_claims, '[]'::jsonb)) = 0,
      'd15_host', 'fastapi_executes_n8n_triggers'
    )
  );

  insert into public.wiki_digest (user_id, wiki_version, generated_at, digest)
  values (
    p_user_id,
    'wiki-1.0',
    coalesce((p_digest->>'generated_at')::timestamptz, now()),
    p_digest
  )
  on conflict (user_id) do update
  set wiki_version = excluded.wiki_version,
      generated_at = excluded.generated_at,
      digest = excluded.digest;
end;
$$ language plpgsql security invoker set search_path = public;

comment on function public.replace_compiled_wiki_page(uuid, text, text, text, text, jsonb, jsonb, jsonb) is
  'Atomic wiki compilation writer used only by FastAPI compile_page. Execution is granted only to service_role; the function sets request.jwt.claim.role and app.wiki_compilation_service transaction-locally, replaces class=compiled claims and evidence, refreshes page embedding, appends compile action log, and upserts the digest.';

revoke all on function public.replace_compiled_wiki_page(uuid, text, text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_compiled_wiki_page(uuid, text, text, text, text, jsonb, jsonb, jsonb) to service_role;

alter table public.wiki_pages enable row level security;
alter table public.wiki_claims enable row level security;
alter table public.wiki_evidence enable row level security;
alter table public.wiki_contradictions enable row level security;
alter table public.wiki_insight_records enable row level security;
alter table public.wiki_action_log enable row level security;
alter table public.wiki_digest enable row level security;
alter table public.global_ip_pages enable row level security;
alter table public.wiki_schema enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wiki_pages',
    'wiki_claims',
    'wiki_evidence',
    'wiki_contradictions',
    'wiki_insight_records',
    'wiki_action_log',
    'wiki_digest'
  ]
  loop
    execute format('drop policy if exists %I_select_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_insert_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_update_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_delete_own on public.%I', table_name, table_name);

    execute format(
      'create policy %I_select_own on public.%I for select to authenticated using (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_insert_own on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_update_own on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_delete_own on public.%I for delete to authenticated using (auth.uid() = user_id)',
      table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists wiki_schema_select_active on public.wiki_schema;
create policy wiki_schema_select_active
  on public.wiki_schema
  for select
  to authenticated
  using (is_active = true);

grant select, insert, update, delete on
  public.wiki_pages,
  public.wiki_claims,
  public.wiki_evidence,
  public.wiki_contradictions,
  public.wiki_insight_records,
  public.wiki_action_log,
  public.wiki_digest
to authenticated;

grant select on public.wiki_schema to authenticated;

revoke all on public.global_ip_pages from anon, authenticated;

grant all on
  public.wiki_pages,
  public.wiki_claims,
  public.wiki_evidence,
  public.wiki_contradictions,
  public.wiki_insight_records,
  public.wiki_action_log,
  public.wiki_digest,
  public.global_ip_pages,
  public.wiki_schema
to service_role;

insert into public.wiki_schema (wiki_schema_version, schema, is_active)
values (
  'wiki-1.0',
  '{
    "wiki_schema_version": "wiki-1.0",
    "pages": {
      "business_context": {"kind": "insight_accreting", "title": "Business Context", "ose_page_type": "business_context"},
      "diagnostic_synthesis": {"kind": "compiled_base_only", "title": "Diagnostic Synthesis", "ose_page_type": "assessment_intelligence"},
      "current_quarter_sprint": {"kind": "compiled_base_only", "title": "Current Quarter / Sprint", "ose_page_type": "strategic_context"},
      "growth_constraints": {"kind": "insight_accreting", "title": "Growth Constraints", "ose_page_type": "strategic_context"},
      "financial_context": {"kind": "insight_accreting", "title": "Financial Context", "ose_page_type": "financial_patterns"},
      "client_market_position": {"kind": "insight_accreting", "title": "Client / Market Position", "ose_page_type": "business_context"},
      "open_questions": {"kind": "insight_accreting", "title": "Open Questions & Unresolved Tensions", "ose_page_type": "conversation_intelligence"}
    },
    "confidence_enum": ["high", "medium", "low"],
    "claim_status_enum": ["active", "quarantined", "trusted", "contested", "retired"],
    "claim_class_enum": ["compiled", "insight", "override"],
    "frontmatter_contract": ["page_key", "wiki_version", "last_compiled_at", "tags"],
    "contradiction_fields": ["contradictions", "contested"],
    "tag_taxonomy": {
      "domains": ["financial", "team", "clients", "offer", "operations", "growth", "positioning"],
      "stages": [
        {"id": 1, "name": "Rising"},
        {"id": 2, "name": "Striving"},
        {"id": 3, "name": "Thriving"},
        {"id": 4, "name": "Driving"},
        {"id": 5, "name": "Arriving"}
      ],
      "stage_content_note": "Schema models stages 1-5; authored/calibrated content currently covers stages 1-4.",
      "tiers": ["<1M", "1-3M", "3-6M", "6M+"]
    },
    "event_rebuild_targets": {
      "ae_ladder_run_updated": ["diagnostic_synthesis"],
      "gm_audit_run_updated": ["diagnostic_synthesis"],
      "quarter_map_changed": ["current_quarter_sprint", "growth_constraints"],
      "sprint_planning_changed": ["current_quarter_sprint"],
      "clarity_compass_changed": ["business_context", "growth_constraints"],
      "diagnostic_constraint_changed": ["growth_constraints"],
      "agency_snapshot_financial_changed": ["financial_context"],
      "structured_upload_changed": ["financial_context"],
      "agency_snapshot_market_changed": ["client_market_position"],
      "growth_velocity_changed": ["client_market_position", "growth_constraints"],
      "wiki_validation_changed": ["open_questions"]
    },
    "ose_mapping_note": "The 7 wiki page_keys are canonical for the wiki layer. OSE seed_core_knowledge_pages() uses five adapter page types: business_context, assessment_intelligence, strategic_context, financial_patterns, conversation_intelligence."
  }'::jsonb,
  true
)
on conflict (wiki_schema_version) do update
set schema = excluded.schema,
    is_active = excluded.is_active,
    updated_at = now();

-- Rollback:
-- DROP TABLE IF EXISTS public.wiki_schema CASCADE;
-- DROP TABLE IF EXISTS public.global_ip_pages CASCADE;
-- DROP TABLE IF EXISTS public.wiki_digest CASCADE;
-- DROP TABLE IF EXISTS public.wiki_action_log CASCADE;
-- DROP TABLE IF EXISTS public.wiki_insight_records CASCADE;
-- DROP TABLE IF EXISTS public.wiki_contradictions CASCADE;
-- DROP TABLE IF EXISTS public.wiki_evidence CASCADE;
-- DROP TABLE IF EXISTS public.wiki_claims CASCADE;
-- DROP TABLE IF EXISTS public.wiki_pages CASCADE;
-- DROP FUNCTION IF EXISTS public.enforce_wiki_compiled_claim_writer CASCADE;
-- DROP FUNCTION IF EXISTS public.update_wiki_updated_at CASCADE;
