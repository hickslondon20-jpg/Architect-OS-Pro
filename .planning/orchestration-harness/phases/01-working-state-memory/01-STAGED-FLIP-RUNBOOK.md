# Phase 1 — Staged Flip Runbook: `vcso_working_state_assembly`

**Date:** 2026-07-13 · **Decision:** founder deferred to orchestration recommendation = **staged-on**.
**Goal:** move working-state assembly from proven-off to production default **incrementally** —
allowlist canary → enable-for-all — with instant rollback, honoring the prove-then-flip discipline.
Annotation re-injection stays **off** (separate later enablement).

## Flag model (live, verified)

`platform_ai_settings` row `setting_key = 'vcso_working_state_assembly'`:
- **`is_enabled`** (column) — master gate for the feature.
- **`settings`** (jsonb) — `test_user_ids[]` (allowlist), `enabled_for_all` (bool), `annotations_enabled`
  (bool), `recent_message_tail` (2), `assembly_token_budget` (6000).

Assumed gating (execution agent to confirm precedence): a founder gets the working-state path when
`is_enabled = true` **AND** (`enabled_for_all = true` **OR** `user_id ∈ test_user_ids`). Annotation
re-injection additionally requires `annotations_enabled = true`.

Pre-canary baseline: `is_enabled=false`, `test_user_ids=[]`, `enabled_for_all=false`,
`annotations_enabled=false`, `assembly_token_budget=6000`, `recent_message_tail=2`.

Current production state (Stage 1 applied 2026-07-13 19:09:21 UTC): `is_enabled=true`,
`test_user_ids=['cd490873-99aa-4533-9240-f0aa04deb54f']`, `enabled_for_all=false`,
`annotations_enabled=false`, `assembly_token_budget=6000`, `recent_message_tail=2`.

---

## Stage 0 — Gate (must clear before any flip)

- [x] **LangSmith trace attached.** With the refreshed key (updated in `.env` + Railway), the execution
      agent queries the working-state thread and attaches paired trace IDs to `01-COMPLETION.md`. This is
      the standing evidence bar (necessary; DB/output already complete). **No flip before this clears.**
- [x] Confirmed production flag matched the baseline immediately before Stage 1.

## Stage 1 — Allowlist canary (test founder only)

**Status:** Active from 2026-07-13 19:09:21 UTC. Stage 2 is not authorized until the observation gate
below passes.

**Apply:**
```sql
update public.platform_ai_settings
set is_enabled = true,
    settings = settings || jsonb_build_object(
      'test_user_ids', jsonb_build_array('cd490873-99aa-4533-9240-f0aa04deb54f'),
      'enabled_for_all', false,
      'annotations_enabled', false),
    updated_at = now()
where setting_key = 'vcso_working_state_assembly';
```

**Observe (≥ 5–10 real turns across ≥ 2 threads, or ~24h of the founder's normal use):**
- **Cost:** first-call `role=main`/`vcso_chat` input tokens land in the bounded window (~8–9k), not the
  legacy ~17–20k.
- **Path active:** each qualifying turn emits a `vcso_working_state_after_turn` (`utility`, Haiku) event.
- **Quality:** spot-check assistant bodies in `vcso_chat_messages` — grounded, cited, on-voice; no
  regressions or founder complaints.
- **Working-state health:** `vcso_chat_threads.working_state` populates + updates (non-null, four families).
- **No spurious fail-open:** first-call input does **not** jump back to ~16k+ on the enrolled founder
  (that signals an assembly error dropping to legacy); backend logs clean of assembly-quarantine spam.

**Go / no-go to Stage 2:** cost holds, quality holds, path active, no fail-open spikes → proceed.
Any material regression → **rollback** and diagnose.

## Stage 2 — Enable for all founders

**Apply (only after Stage 1 go):**
```sql
update public.platform_ai_settings
set settings = settings || jsonb_build_object('enabled_for_all', true),
    updated_at = now()
where setting_key = 'vcso_working_state_assembly';
```
Keep `is_enabled=true`; leave `test_user_ids` as-is (harmless once `enabled_for_all=true`).

**Observe (first ~24–48h of broad traffic):**
- Aggregate first-call main input trends down vs. the pre-flip baseline; `afterTurn` events scale with
  active VCSO usage.
- Watch fail-open rate (legacy-sized first-call turns among enrolled founders), error logs, and any
  founder-reported quality issues. Multi-founder isolation already RLS-proven; watch for anomalies anyway.

**Steady state:** annotations remain off; the working-state path is the default assembly for all founders.

## Rollback (instant, any stage)

```sql
update public.platform_ai_settings
set is_enabled = false,
    settings = settings || jsonb_build_object('test_user_ids', '[]'::jsonb, 'enabled_for_all', false),
    updated_at = now()
where setting_key = 'vcso_working_state_assembly';
```
Effect: every turn reverts to the legacy `_build_context` assembly immediately. Fail-open already covers
mid-turn assembly errors, so rollback is a clean master-off, not a code change. No deploy required.

## Monitoring queries

```sql
-- Working-state path activity + cost signal (afterTurn only fires on the working-state path)
select date_trunc('hour', created_at) hr, count(*) afterturn_events, round(avg(input_tokens)) avg_worker_in
from public.ai_usage_log
where capability_key = 'vcso_working_state_after_turn' and created_at > now() - interval '2 days'
group by 1 order by 1 desc;

-- First-call main input for the canary founder (watch for bounded ~8–9k vs legacy ~17–20k / fail-open)
select created_at, capability_key, input_tokens, output_tokens
from public.ai_usage_log
where user_id = 'cd490873-99aa-4533-9240-f0aa04deb54f'
  and role = 'main' and capability_key = 'vcso_chat'
order by created_at desc limit 25;
```

## Ownership & records

- **Stage 0** (trace): execution agent, with the refreshed LangSmith key.
- **Stage 1 / Stage 2 flips:** run by the orchestration agent (Supabase MCP) or the execution agent, on
  founder go at each gate.
- On Stage 2 steady state: mark Phase 1 **Done** in `ROADMAP.md` + `STATE.md` + `Pro-Suite-Progress.md`,
  note the flip in `01-COMPLETION.md`, then proceed to **Phase 2 (intent read) planning**.

## Explicitly deferred
Annotation re-injection (`annotations_enabled`) — proven but orthogonal to the cost win; enable
deliberately later. Do not enable it during this flip.
