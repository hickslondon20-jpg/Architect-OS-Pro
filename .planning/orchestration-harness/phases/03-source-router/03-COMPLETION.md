# Phase 3 Completion Evidence — Tier-Escalating Source Router

**Date:** 2026-07-14
**Status:** Complete; founder-only canary proven; global default flip pending London.

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
- Commit `ab86c8c9` — `v0.6.19 Record Phase 3 London checkpoint`.
- Commit `a07c7493` — `v0.6.20 Avoid redundant router refetch`.
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

- Focused Phase 1–3 suite after the router-prefetch contract: 30 passed.
- Broader VCSO regression suite: 28 passed, 12 existing live-fixture tests skipped.
- `python -m compileall -q python-backend`: exit 0.
- `git diff --check`: clean for the implementation commit.
- No `src` file changed; a frontend build was not required.

## Authenticated control and founder-canary proof

London ran the same three prompts in a flag-off control thread and a founder-only router thread. The
first canary exposed one redundant Tier-0 rediscovery call and was rolled back immediately. Commit
`a07c7493` added a router-only prompt contract to use selected components before tools while preserving
the full registry for specific gaps. The post-fix canary then produced the intended deterministic
route on thread `e91802d1-957d-4571-b66d-aaa394af8119`:

| Question | Route | Router tools | Quality result |
|---|---|---|---|
| Current sprint initiative | Tier 0 → stop | none | Correct current goal and initiative from platform records, cited |
| Margin compression + concentration | Tier 1 → stop | 2 `wiki_search`, 2 `wiki_get_page` | Clear sequence, standing guardrail, named failure mode, and three evidence gaps, cited |
| Named document read | Tier 3 → stop | 1 failed `wiki_get_page`; injected raw source still answered | Three faithful founder-dependency findings quoted and cited from the named document |

The strategic tool calls filled specific portfolio and operating-detail gaps; they demonstrate that
mid-turn escalation remains available. The Tier-3 tool error did not break or weaken the turn because
the router-prefetched raw document remained usable.

### Cost comparison

Main-model (`role=main`, `capability_key=vcso_chat`) token accounting from `ai_usage_log`:

| Question | Control input | Canary input | Change | Control output | Canary output |
|---|---:|---:|---:|---:|---:|
| Tier-0 record | 11,299 | 11,631 | +2.9% | 566 | 538 |
| Tier-1 strategy | 58,619 | 62,709 | +7.0% | 2,760 | 2,678 |
| Tier-3 document | 38,291 | 22,548 | -41.1% | 1,076 | 832 |
| **Mixed-set total** | **108,209** | **96,888** | **-10.5%** | **4,402** | **4,048** |

The record turn stopped at Tier 0 with no retrieval tools. The strategic turn remained quality-first
and used the same four targeted wiki calls as control. The direct-document route supplied the main
cost win by avoiding a raw KB crawl. Across the matched mixed set, input fell 11,321 tokens with no
observed quality regression.

### Paired LangSmith traces

LangSmith was queried read-only using the configured project credential without printing the key.
Every trace below carries the exact thread id and `capability_key=vcso_chat`; prompt/completion token
counts match the corresponding `ai_usage_log` row. First main calls are the compact comparison anchors:

| Question | Control LangSmith trace | Control DB run | Canary LangSmith trace | Canary DB run | Control in/out | Canary in/out |
|---|---|---|---|---|---:|---:|
| Tier-0 record | `d01edce7-950b-4bb3-a46e-0fa4f546e05b` | `d7028c5b-952b-45d7-9610-92b1eea4acdd` | `d337c7f6-7246-4760-9fda-56208ed65c26` | `73ba1913-9195-4c34-bbd8-1936ee95a13a` | 7,033 / 299 | 7,040 / 276 |
| Tier-1 strategy | `1fb41eb4-2c8d-4787-ad37-467ddb5dec35` | `b2213923-f216-4e52-9933-ba6994388698` | `3a083f57-f4b6-4f11-b56c-f563d88ae211` | `65a1f0f2-f721-46bc-a3e1-862adec8a876` | 8,989 / 96 | 8,893 / 98 |
| Tier-3 document | `79eb1cfc-04e7-4dac-8bcc-16dbad23b352` | `787a8bef-0974-4dc9-ab67-fac43f8a3a71` | `7cb1792b-febf-44a2-bf37-f322e17fcdc4` | `b4ace907-c828-4a24-97c5-402d6c5cccfc` | 9,231 / 58 | 8,275 / 79 |

All 19 main calls across both matched threads were independently enumerated in LangSmith and matched
the database token rows exactly (10 control, 9 canary).

## London checkpoint — global default flip only

The cost + quality proof passes. Phase 3 is complete and the founder-only canary remains active.
`vcso_source_router.settings.enabled_for_all` remains `false`; its default is unchanged. Phase 2
remains disabled with zero enrollment. London must now decide whether to enable the router globally,
sequenced only after the separate Phase 1 and Phase 2 flip decisions. No flag was flipped here and
Phase 4 has not started.
