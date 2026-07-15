# Spine Validation Runbook — Batched Proof of the Full Orchestration Harness

**Date:** 2026-07-14 · **Scope:** validate the entire built-dark spine — **P1 working-state → P2 intent
→ P3 router → P4 planner** — together on the founder canary, in one integrated pass, then pay down all
deferred proof-debt. **Founder-confirmed shape:** deploy P4 dark → enable all four flags for the canary
→ run one compact integrated proof set (incl. the P4 capstone) → stop-and-review → (low-stakes) broad
rollout.

**Context:** No beta users exist yet, so `enabled_for_all` affects no real users — the canary founder
(`cd490873-99aa-4533-9240-f0aa04deb54f`) is effectively the only live user. The canary proof is the
substantive validation; broad rollout is a formality done at the end.

**Roles:** the **execution/orchestration agent** deploys, flips flags (Supabase MCP), and verifies from
DB + LangSmith. **London** drives the real VCSO turns (he is the canary founder). Every claim pairs a
LangSmith trace with an `ai_usage_log`/output check.

**The four flags** (all `platform_ai_settings`, Phase-1 flag shape — `is_enabled` + `settings.{test_user_ids,
enabled_for_all,...}`): `vcso_working_state_assembly` (P1, already canary-on), `vcso_intent_read` (P2),
`vcso_source_router` (P3), `vcso_planner` (P4). `annotations_enabled` stays **off** throughout.

---

## Step 0 — Deploy P4 dark (authorized)

- Execution agent: push `67d7acd2` (`v0.6.22`) to `origin/main` → triggers the shared deploy.
  **Founder-authorized.** P4 ships **dark** (`vcso_planner` off) — behavior unchanged on deploy.
- Verify: production health 200; a smoke VCSO turn still logs `surface='virtual_cso'`; `vcso_planner`
  still off, zero enrollment. If the deploy goes red (import/syntax) → halt and report.

## Step 1 — Matched control baseline (spine OFF) — REUSE when valid (budget conservation)

**Control reuse rule.** The control is the flat/spine-off baseline for the capstone cost delta. Because
every remediation changes **flag-gated spine code that does not run on the control path**, a **retained
control is reusable** across restarts — **reuse it if (a) no change since it was captured touched the
flat/spine-off assembly+retrieval code, and (b) the founder's wiki/dataset is unchanged.** If both hold,
**skip re-running control**, re-run only the canary, and compare to the retained baseline. Re-establish a
fresh control only if either changed. (The flat-path **input tokens are deterministic** given the same
data + question, so the delta holds despite LLM output variance.)

If a fresh control **is** needed: with **all four flags off** (temporarily set P1 `is_enabled=false` too,
or use a separate control thread per the Phase 3 mechanism), London runs the **Capstone question** in a
**control thread**; record `role=main`/`vcso_chat` input/output tokens + the answer.

*(The non-capstone paths were each proven against control individually in Phases 1/3; canary-only
integration confirmation suffices for them — no control needed.)*

**Budget principle:** validate mechanism correctness **offline** (eval sets like the P2 14/14; Phase-3-
style read-only deterministic router/planner execution — no live model turns) and reserve **live turns
for the minimal integrated cost/quality proof** (the capstone).

## Step 2 — Enable the full spine for the canary

Apply (execution agent, Supabase MCP), enabling P2/P3/P4 for the canary and confirming P1:
```sql
update public.platform_ai_settings
set is_enabled = true,
    settings = settings || jsonb_build_object(
      'test_user_ids', jsonb_build_array('cd490873-99aa-4533-9240-f0aa04deb54f'),
      'enabled_for_all', false)
      -- annotations stay off; leave other keys intact
    , updated_at = now()
where setting_key in ('vcso_working_state_assembly','vcso_intent_read','vcso_source_router','vcso_planner');
```
Verify each row: `is_enabled=true`, canary in `test_user_ids`, `enabled_for_all=false`,
`annotations_enabled=false` (P1). The full spine is now live for the canary only.

## Step 3 — Run the integrated proof set (London drives; ~6 turns, 2 threads)

**Thread A — strategic (the capstone + working-state carry):**
1. **Capstone (matched to Step 1 control):** *"My top-three client concentration is climbing while
   margin compresses — what should I do?"* → expect intent `strategic_synthesis`+`deep` → **planner
   decomposes** → **≥2 workers incl. a sandbox compute over the founder dataset** (concentration/margin)
   → **compose** a cited, sequenced answer.
2. **Follow-up (working-state carry):** *"Of those moves, which do I sequence first and why?"* → expect
   it to build on turn 1 (decisions/open-questions carried in `working_state`), not restart.
3. **Known-unknowns:** *"What don't we know yet that would change your recommendation?"* → expect
   `known_unknowns` surfaced.

**Thread B — mixed paths (integration smoke, canary-only):**
4. **Tier-0 record lookup:** *"What's my current sprint goal and top initiative?"* → intent `lookup`,
   router **Tier-0 → stop**, cheap, cited from platform records, no raw crawl.
5. **Tier-3 document lookup:** *"What does the Northlight Digital – Agency Overview say about our
   delivery model?"* → intent `lookup`, router **Tier-3**, cited from the document.
6. **Brainstorm:** *"I'm thinking about productizing our retainer — help me think it through."* →
   intent `brainstorm`, advance-the-thinking posture, **no forced answer, no decomposition**.

## Step 4 — Verify (execution/orchestration agent, per turn)

For each turn, confirm from the DB + LangSmith:
- **P2 intent** recorded on `vcso_chat_messages.intent` (move_type/depth/confidence) matches the expected class.
- **P3 routing** recorded on `vcso_chat_messages.routing` (start tier, escalations, sources); record turns
  stop at Tier-0, document turns reach Tier-3, strategic composes from Tier-1 components.
- **P4 planner** (Thread A turn 1): `agent_delegation_runs`/`_steps` show the decomposition + **≥2
  workers** with `parent_run_id` = the VCSO run; workers on **Haiku** (`tier_worker`), composer on
  **Sonnet** — **independent parent/child cost attribution** holds; the **sandbox worker** returned a
  computed result + derivation.
- **P1 working-state**: `vcso_chat_threads.working_state` populates + carries across Thread A turns.
- **Cost:** the **Capstone canary vs. the Step-1 control** — the strategic turn is **cheaper** (composes
  over compact findings, no raw re-crawl), **closing the Phase 3 strategy-cost carry-forward**; simple
  turns bounded.
- **Quality:** every answer cited, complete, on-voice; brainstorm advances thinking without forcing a
  conclusion; **no regression** vs. control.
- **Transparency:** plan + workers + routing render **sanitized** via MA-05 (no raw CoT).
- **LangSmith:** each turn's trace matches its `ai_usage_log` row (thread id + `capability_key`).

## Step 5 — Stop-and-review checkpoint (the cost-routing capstone)

Deliver the integrated evidence table (per-turn intent/route/plan + the capstone cost delta + parent/
child attribution + quality) to **London**. **This is the workstream's cost-routing checkpoint.** Do not
broaden (Phase 6, disabled workers, freshness/MCP) or flip `enabled_for_all` until reviewed.

## Step 6 — Broad rollout (low-stakes; on London's go)

Since no beta users exist, flipping the whole spine to all founders is a formality. On London's go, per
layer (or together):
```sql
update public.platform_ai_settings
set settings = settings || jsonb_build_object('enabled_for_all', true), updated_at = now()
where setting_key in ('vcso_working_state_assembly','vcso_intent_read','vcso_source_router','vcso_planner');
```
Then mark Phases 1–4 **Done** in `ROADMAP.md`/`STATE.md`/`Pro-Suite-Progress.md` and each phase's
`0X-COMPLETION.md`; close the workstream carry-forwards.

## Rollback (instant, any point)
Set `is_enabled=false` (and/or `enabled_for_all=false`, `test_user_ids='[]'`) on any/all four rows →
that layer reverts to its lower-layer/flat path immediately (each is fail-open). No deploy required.
```sql
update public.platform_ai_settings
set is_enabled=false, settings = settings || jsonb_build_object('test_user_ids','[]'::jsonb,'enabled_for_all',false),
    updated_at=now()
where setting_key in ('vcso_working_state_assembly','vcso_intent_read','vcso_source_router','vcso_planner');
```

## Monitoring queries
```sql
-- Per-turn spine signal for the canary: intent + routing recorded, cost
select m.created_at, left(m.content,48) as msg, m.role,
       (m.intent->>'move_type') as intent, (m.routing->>'start_tier') as start_tier,
       u.input_tokens, u.output_tokens
from public.vcso_chat_messages m
left join public.ai_usage_log u
  on u.thread_id = m.thread_id and u.role='main' and u.capability_key='vcso_chat'
     and u.created_at between m.created_at - interval '30 seconds' and m.created_at + interval '90 seconds'
where m.user_id='cd490873-99aa-4533-9240-f0aa04deb54f'
order by m.created_at desc limit 30;

-- Capstone planner workers: parent/child attribution (Haiku workers under the Sonnet parent)
select r.created_at, r.capability_key, r.status, r.parent_run_id,
       l.role, l.model, l.input_tokens, l.output_tokens
from public.agent_delegation_runs r
left join public.ai_usage_log l on l.run_id = r.id
where r.user_id='cd490873-99aa-4533-9240-f0aa04deb54f' and r.created_at > now() - interval '2 hours'
order by r.created_at desc;
```
