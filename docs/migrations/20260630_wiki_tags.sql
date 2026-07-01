-- ArchitectOS Wiki System Sub-phase 06: validation, health, and page tags.
-- Additive only: wiki-1.0 contract and claim/evidence/digest shapes remain unchanged.

alter table public.wiki_pages
  add column if not exists tags text[] not null default '{}';

create or replace function public.valid_tag(p_tag text)
returns boolean
language sql
stable
as $$
  select p_tag = any (array[
    'financial',
    'team',
    'clients',
    'offer',
    'operations',
    'growth',
    'positioning',
    '1',
    '2',
    '3',
    '4',
    '5',
    'Rising',
    'Striving',
    'Thriving',
    'Driving',
    'Arriving',
    '<1M',
    '1-3M',
    '3-6M',
    '6M+'
  ]);
$$;

comment on function public.valid_tag(text) is
  'Bounded ArchitectOS wiki-1.0 tag validator. Mirrors config/wiki_schema.json tag_taxonomy for Supabase-side health checks.';

create or replace function public.wiki_source_resolves(
  p_user_id uuid,
  p_source_kind text,
  p_source_id text,
  p_path text
)
returns boolean
language plpgsql
stable
as $$
declare
  v_table text;
  v_exists boolean := false;
  v_id_column text;
begin
  if nullif(p_source_id, '') is null then
    return false;
  end if;

  v_table := case p_source_kind
    when 'raw_document' then 'ose_raw_document_registry'
    when 'document_chunk' then 'document_chunks'
    when 'global_checkpoint' then 'gm_checkpoints'
    when 'tier0_record' then split_part(coalesce(p_path, ''), '/', 1)
    else null
  end;

  if nullif(v_table, '') is null or to_regclass(format('public.%I', v_table)) is null then
    return false;
  end if;

  foreach v_id_column in array array['id', 'document_id', 'chunk_id', 'checkpoint_id', 'assessment_id', 'snapshot_id', 'run_id', 'dataset_id', 'gm_assessment_id']
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = v_id_column
    ) then
      execute format('select exists (select 1 from public.%I where %I::text = $1)', v_table, v_id_column)
      into v_exists
      using p_source_id;

      if v_exists then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

comment on function public.wiki_source_resolves(uuid, text, text, text) is
  'Best-effort source-reference resolver for wiki evidence. Used only by validation findings; it does not mutate or repair evidence.';

update public.wiki_pages
set tags = case page_key
  when 'business_context' then array['operations', 'growth']
  when 'diagnostic_synthesis' then array['operations', 'growth']
  when 'current_quarter_sprint' then array['operations', 'growth']
  when 'growth_constraints' then array['growth', 'operations']
  when 'financial_context' then array['financial']
  when 'client_market_position' then array['clients', 'positioning']
  when 'open_questions' then array['operations']
  else tags
end
where tags = '{}';

update public.wiki_schema
set schema = jsonb_set(
    schema,
    '{pages}',
    jsonb_build_object(
      'business_context', coalesce(schema #> '{pages,business_context}', '{}'::jsonb) || '{"default_tags":["operations","growth"]}'::jsonb,
      'diagnostic_synthesis', coalesce(schema #> '{pages,diagnostic_synthesis}', '{}'::jsonb) || '{"default_tags":["operations","growth"]}'::jsonb,
      'current_quarter_sprint', coalesce(schema #> '{pages,current_quarter_sprint}', '{}'::jsonb) || '{"default_tags":["operations","growth"]}'::jsonb,
      'growth_constraints', coalesce(schema #> '{pages,growth_constraints}', '{}'::jsonb) || '{"default_tags":["growth","operations"]}'::jsonb,
      'financial_context', coalesce(schema #> '{pages,financial_context}', '{}'::jsonb) || '{"default_tags":["financial"]}'::jsonb,
      'client_market_position', coalesce(schema #> '{pages,client_market_position}', '{}'::jsonb) || '{"default_tags":["clients","positioning"]}'::jsonb,
      'open_questions', coalesce(schema #> '{pages,open_questions}', '{}'::jsonb) || '{"default_tags":["operations"]}'::jsonb
    ),
    true
  ),
  updated_at = now()
where wiki_schema_version = 'wiki-1.0';

create or replace function public.wiki_validation_findings(p_user_id uuid)
returns table (
  check_name text,
  claim_id uuid,
  page_key text,
  reason text
)
language sql
stable
as $$
  with claims_with_evidence as (
    select c.id, c.page_key, count(e.id) as evidence_count
    from public.wiki_claims c
    left join public.wiki_evidence e
      on e.user_id = c.user_id
     and e.claim_id = c.id
    where c.user_id = p_user_id
      and c.status <> 'retired'
    group by c.id, c.page_key
  ),
  broken_provenance as (
    select
      'broken-provenance'::text as check_name,
      c.id as claim_id,
      c.page_key,
      'Claim has no evidence rows.'::text as reason
    from claims_with_evidence c
    where c.evidence_count = 0

    union all

    select
      'broken-provenance'::text,
      e.claim_id,
      c.page_key,
      'Evidence row has an empty source reference.'::text
    from public.wiki_evidence e
    join public.wiki_claims c
      on c.user_id = e.user_id
     and c.id = e.claim_id
    where e.user_id = p_user_id
      and (nullif(e.source_id, '') is null or nullif(e.source_kind, '') is null or nullif(e.path, '') is null)

    union all

    select
      'broken-provenance'::text,
      e.claim_id,
      c.page_key,
      format('Evidence source "%s" (%s) does not resolve.', e.source_id, e.source_kind)::text
    from public.wiki_evidence e
    join public.wiki_claims c
      on c.user_id = e.user_id
     and c.id = e.claim_id
    where e.user_id = p_user_id
      and nullif(e.source_id, '') is not null
      and nullif(e.source_kind, '') is not null
      and not public.wiki_source_resolves(e.user_id, e.source_kind, e.source_id, e.path)
  ),
  frontmatter_contract as (
    select
      'frontmatter-contract'::text as check_name,
      null::uuid as claim_id,
      p.page_key,
      'Page is missing a required frontmatter contract field.'::text as reason
    from public.wiki_pages p
    where p.user_id = p_user_id
      and (
        nullif(p.page_key, '') is null
        or p.wiki_version <> 'wiki-1.0'
        or p.last_compiled_at is null
        or p.tags is null
      )

    union all

    select
      'frontmatter-contract'::text,
      c.id,
      c.page_key,
      'Claim has a class, status, or confidence outside wiki-1.0 enums.'::text
    from public.wiki_claims c
    where c.user_id = p_user_id
      and (
        c.class not in ('compiled', 'insight', 'override')
        or c.status not in ('active', 'quarantined', 'trusted', 'contested', 'retired')
        or c.confidence not in ('high', 'medium', 'low')
      )
  ),
  off_taxonomy_tags as (
    select
      'off-taxonomy-tags'::text as check_name,
      null::uuid as claim_id,
      p.page_key,
      format('Page tag "%s" is not in tag_taxonomy.', tag_value)::text as reason
    from public.wiki_pages p
    cross join lateral unnest(p.tags) as tag_value
    where p.user_id = p_user_id
      and not public.valid_tag(tag_value)
  ),
  stale_drifted as (
    select
      'stale-drifted'::text as check_name,
      null::uuid as claim_id,
      p.page_key,
      'Page is marked stale.'::text as reason
    from public.wiki_pages p
    where p.user_id = p_user_id
      and p.stale = true

    union all

    select
      'stale-drifted'::text,
      c.id,
      c.page_key,
      'Claim was updated after the page was last compiled.'::text
    from public.wiki_claims c
    join public.wiki_pages p
      on p.user_id = c.user_id
     and p.id = c.page_id
    where c.user_id = p_user_id
      and p.last_compiled_at is not null
      and c.updated_at > p.last_compiled_at
      and c.status <> 'retired'
  ),
  contested as (
    select
      'contested'::text as check_name,
      c.claim_id,
      wc.page_key,
      coalesce(nullif(c.note, ''), 'Open contradiction.')::text as reason
    from public.wiki_contradictions c
    join public.wiki_claims wc
      on wc.user_id = c.user_id
     and wc.id = c.claim_id
    where c.user_id = p_user_id
      and c.resolved = false

    union all

    select
      'contested'::text,
      c.against_claim_id,
      wc.page_key,
      coalesce(nullif(c.note, ''), 'Open contradiction against this claim.')::text
    from public.wiki_contradictions c
    join public.wiki_claims wc
      on wc.user_id = c.user_id
     and wc.id = c.against_claim_id
    where c.user_id = p_user_id
      and c.resolved = false
      and c.against_claim_id is not null

    union all

    select
      'contested'::text,
      c.id,
      c.page_key,
      'Claim status is contested.'::text
    from public.wiki_claims c
    where c.user_id = p_user_id
      and c.status = 'contested'
  ),
  orphans as (
    select
      'orphans'::text as check_name,
      null::uuid as claim_id,
      p.page_key,
      'Page has no claims.'::text as reason
    from public.wiki_pages p
    left join public.wiki_claims c
      on c.user_id = p.user_id
     and c.page_id = p.id
     and c.status <> 'retired'
    where p.user_id = p_user_id
    group by p.page_key
    having count(c.id) = 0
  )
  select * from broken_provenance
  union all select * from frontmatter_contract
  union all select * from off_taxonomy_tags
  union all select * from stale_drifted
  union all select * from contested
  union all select * from orphans;
$$;

comment on function public.wiki_validation_findings(uuid) is
  'Runs the six A7 wiki validation checks for a user and returns structured findings only. It never deletes, resolves, or auto-fixes data.';

create or replace function public.wiki_health(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_open_questions jsonb;
  v_contradictions jsonb;
  v_low_confidence jsonb;
  v_claim_health jsonb;
  v_stale_pages jsonb;
  v_counts jsonb;
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'claim_id', id,
    'page_key', page_key,
    'question', text,
    'confidence', confidence,
    'status', status
  ) order by updated_at desc), '[]'::jsonb)
  into v_open_questions
  from public.wiki_claims
  where user_id = p_user_id
    and page_key = 'open_questions'
    and status <> 'retired';

  select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
  into v_contradictions
  from (
    select jsonb_build_object(
      'contradiction_id', ct.id,
      'claim_id', ct.claim_id,
      'against_claim_id', ct.against_claim_id,
      'against_page_ref', ct.against_page_ref,
      'reason', coalesce(nullif(ct.note, ''), 'Open contradiction.'),
      'created_at', ct.created_at
    ) as item
    from public.wiki_contradictions ct
    where ct.user_id = p_user_id
      and ct.resolved = false
  ) rows;

  select coalesce(jsonb_agg(jsonb_build_object(
    'claim_id', id,
    'page_key', page_key,
    'reason', 'Claim confidence is low.',
    'text', text
  ) order by updated_at desc), '[]'::jsonb)
  into v_low_confidence
  from public.wiki_claims
  where user_id = p_user_id
    and confidence = 'low'
    and status <> 'retired';

  select coalesce(jsonb_agg(jsonb_build_object(
    'check', check_name,
    'claim_id', claim_id,
    'page_key', page_key,
    'reason', reason
  ) order by check_name, page_key), '[]'::jsonb)
  into v_claim_health
  from public.wiki_validation_findings(p_user_id)
  where check_name in ('broken-provenance', 'contested', 'stale-drifted', 'orphans');

  select coalesce(jsonb_agg(jsonb_build_object(
    'page_key', page_key,
    'reason', reason
  ) order by page_key), '[]'::jsonb)
  into v_stale_pages
  from public.wiki_validation_findings(p_user_id)
  where check_name = 'stale-drifted'
    and claim_id is null;

  v_counts := jsonb_build_object(
    'contradictions', jsonb_array_length(v_contradictions),
    'open_questions', jsonb_array_length(v_open_questions),
    'low_confidence', jsonb_array_length(v_low_confidence),
    'claim_health', jsonb_array_length(v_claim_health),
    'stale_pages', jsonb_array_length(v_stale_pages)
  );

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'generated_at', now(),
    'dashboards', jsonb_build_object(
      'open-questions', v_open_questions,
      'contradictions', v_contradictions,
      'low-confidence', v_low_confidence,
      'claim-health', v_claim_health,
      'stale-pages', v_stale_pages
    ),
    'open_questions_page_feed', v_open_questions || v_contradictions,
    'counts', v_counts
  );

  update public.wiki_digest
  set generated_at = now(),
      digest = jsonb_set(
        digest,
        '{counts}',
        coalesce(digest->'counts', '{}'::jsonb) || v_counts,
        true
      )
  where user_id = p_user_id;

  if not found then
    insert into public.wiki_digest (user_id, wiki_version, generated_at, digest)
    values (
      p_user_id,
      'wiki-1.0',
      now(),
      jsonb_build_object(
        'user_id', p_user_id,
        'wiki_version', 'wiki-1.0',
        'generated_at', now(),
        'pages', '[]'::jsonb,
        'top_claims', '[]'::jsonb,
        'counts', v_counts,
        'qualifiers', '{}'::jsonb
      )
    );
  end if;

  return v_result;
end;
$$;

comment on function public.wiki_health(uuid) is
  'Returns the five B8 health dashboards for a user and persists rollup counts into wiki_digest.digest.counts. Findings remain advisory and are never auto-resolved.';

grant execute on function public.valid_tag(text) to authenticated, service_role;
grant execute on function public.wiki_source_resolves(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.wiki_validation_findings(uuid) to authenticated, service_role;
grant execute on function public.wiki_health(uuid) to authenticated, service_role;
