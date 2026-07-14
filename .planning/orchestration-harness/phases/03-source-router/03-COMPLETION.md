# Phase 3 Completion Evidence — Tier-Escalating Source Router

**Date:** 2026-07-13
**Status:** Code complete; founder-only canary active; authenticated cost/quality gate pending London.

## Scope delivered

- `vcso_source_router` uses the Phase 1 flag shape: master gate plus `enabled_for_all` or a founder
  allowlist. Its live global default remains off.
- The deterministic plan is cheapest-first over Tier 0 records, Tier 1 components, Tier 2 existing
  hybrid search, and Tier 3 existing raw-document navigation. Availability is the only escalation
  signal; there is no model-judged quality loop.
- Tier 1 reads the seven fixed Layer-1 pages directly through `WikiReadService` and modular Layer-2
  pages through `DocWikiReadService`. It never depends on the unverified wiki-to-OSE projection and
  never writes either wiki.
- Tier 0 uses the verified live schemas for Growth Model, AE Ladder, sprint, and Quarter Map records.
  Parent ownership is checked when resolving child-record citations.
- Selected components flow into the Phase 1 `assemble()` seam. Existing registry tools remain fully
  available for mid-turn escalation; the router does not narrow permissions.
- The sanitized decision is persisted on the founder-owned message and rendered as an MA-05
  `source_review` step. The Phase 5 live-source tier is documented only as `phase_5_noop`.

## Shipped implementation

- Commit `04222dbb` — `v0.6.18 Orchestration Harness Phase 3 source router`.
- Migration `20260713_orchestration_harness_source_router.sql` is applied to Supabase project
  `pwacpjqkntnovndhspxt`.
- Production health returned HTTP 200 after the push.

## Live schema, flag, and isolation

- `vcso_chat_messages.routing jsonb` is live.
- `vcso_source_router` is live with Tier order `[0,1,2,3]`, `live_tier_hook=phase_5_noop`,
  `enabled_for_all=false`, and one allowlisted test founder.
- `vcso_intent_read` remains disabled with zero enrollment; no Phase 1 or Phase 2 flip was performed.
- `vcso_chat_messages` retains its four founder-owned RLS policies. The routing update is additionally
  scoped by message id, thread id, and user id.
- Direct RLS replay returned 66 messages for the enrolled founder, zero for an unrelated authenticated
  UUID, and zero for `anon`.
- Supabase advisories still report the existing GraphQL-grant visibility and RLS-init-plan warnings on
  `vcso_chat_messages`; direct replay confirms those grants do not bypass founder row isolation. The
  additive column introduced no router table or new policy surface.

## Deterministic acceptance

Read-only execution of the shipped router against the production store returned:

| Case | Start | Consulted | Stop | Sources |
|---|---:|---|---:|---|
| Current sprint initiative | 0 | `[0]` | 0 | 2 Tier-0 records |
| Margin compression + concentration strategy | 1 | `[1]` | 1 | 6 components; claim/evidence/page refs |
| Named document read | 3 | `[3]` | 3 | 1 raw document |

The strategic case used the two-source component layer and did not invoke raw-document navigation.
The named-document case used the existing KB navigation primitive. Tests also cover Tier-1 absence
escalating to Tier 2 and a deliberately absent founder-operating page degrading to another available
component.

## Fail-open and governance proof

- Router flag off returns the unchanged Phase 1 two-source component read.
- A forced router exception propagates to the existing outer assembly quarantine, whose regression
  test proves fallback to the legacy flat-tool-bag context.
- The model's registry tools are constructed before routing and remain unchanged on the router path,
  so under-fetch does not remove mid-turn retrieval access.
- Routing trace output contains only tier facts, reason codes, counts, and sanitized source labels; it
  contains no hidden reasoning or raw chain-of-thought.
- No decomposition, delegation, live MCP call, freshness policy, feeder, projection, or wiki authoring
  was added.

## Verification

- Focused Phase 1–3 suite: 28 passed.
- Broader VCSO regression suite: 28 passed, 12 existing live-fixture tests skipped.
- `python -m compileall -q python-backend`: exit 0.
- `git diff --check`: clean for the implementation commit.
- No `src` file changed; a frontend build was not required.

## London checkpoint — required before default flip

The authenticated production-turn cost/quality proof is not claimed complete. The safe browser path
had no signed-in ArchitectOS session, and minting a founder session through service-role admin access
was blocked as an unacceptable credential action. Therefore no paired mixed-set assistant output,
`ai_usage_log`, or LangSmith trace was manufactured or inferred.

Next action: London signs in to ArchitectOS (or explicitly authorizes a dedicated test session), then
run the mixed record/strategy/raw-document set through `/api/vcso/chat`, pair the routing rows and
outputs with `ai_usage_log` and LangSmith, and decide whether to flip the global default. Until that
proof passes, keep `enabled_for_all=false`, do not flip Phase 1/2 from this run, and do not start Phase 4.
