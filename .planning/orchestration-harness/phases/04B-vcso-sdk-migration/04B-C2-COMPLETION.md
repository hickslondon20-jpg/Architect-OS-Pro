# 04B Phase C2 Completion — Streaming Surface Redesign

**Completed:** 2026-07-15  
**Decision:** **PASS — native SDK streaming surface and reload lifecycle proven on live.**  
**Checkpoint:** Phase C2 complete; return to London. Phase D has not started.  
**Production state:** `vcso_sdk_loop` disabled, `enabled_for_all=false`, `default=false`, zero enrolled founders.

## Shipped behind the existing SDK flag

- `d5a6f280` (`v0.6.38`) records the research-first SSE current→target gap.
- `89142d51` (`v0.6.39`) adds the only sanctioned backend behavior: explicit, curated
  `<narration>` segments normalize into the existing `token` event with additive `channel`,
  `sdkMode`, and `segmentId` fields. Narration is excluded from the persisted founder answer.
- `4606bff1` (`v0.6.40`) gives SDK-tagged messages a flowing activity timeline, compact drill-down
  chips, and a living right-hand progress rail. Legacy messages continue through the existing
  `AgentStepsPanel` and sources-only rail.
- `3c8f654c` (`v0.6.41`) contains the wider progress layout without horizontal overflow.
- `de9523a3` (`v0.6.42`) persists only the curated narration segments inside the existing
  `structured_result` JSON and restores them into their tool-order position after completion/reload.
  No table, column, policy, API route, or SSE event type was added.

## Current → target result

- Real answer deltas render token-by-token; the frontend does not learn the Agent SDK protocol.
- Interstitial narration renders as ordinary founder-facing prose between lifecycle/tool chips.
- Step chips show status, tool/title, and one curated line. Expansion repeats curated detail and at
  most three safe source labels; raw `input_summary`, `output_summary`, JSON, and chain-of-thought are
  never rendered.
- The 300px right rail advances from lifecycle steps and `todos_updated`, with completed, active, and
  pending states. Existing sources remain directly below it.
- The surface is activated only by the founder-scoped SDK signal or a persisted
  `vcso_sdk_standard_v1` message. Flag-off conversations retain the legacy renderer.

Visual evidence:

- Before: founder-supplied `Screenshot 2026-07-12 234633.png`, `234742.png`, and `234806.png`.
- After: `04B-C2-AFTER.png` (production after a full reload; narration + Wiki Search chip + 5/5 plan).

## Authenticated live canary

Prompt: `Use wiki_search to search my compiled wiki for 'Northlight client concentration' and summarize the strongest finding.`

| Evidence | Result |
|---|---|
| SDK run | `adb92222-0b32-4950-b60e-4aa73b11035d` |
| Thread / assistant | `e0d2d75e-9db2-450d-b1d5-f25da79ef694` / `ff6ce044-cbfb-4f22-aa78-f09d91182147` |
| Stream | `partial_text_delta`; curated narration appeared before `Wiki Search`; plan advanced 4/5→5/5 |
| Persisted narration | segment 1: `Searching the compiled wiki for Northlight client concentration findings now.` |
| Stored tool step | `wiki_search`; curated summary; `{}` input/output; five safe source refs |
| Answer | 1,577 characters, cited and founder-visible |
| Usage | `a8ba6005-5eb6-4b44-8be7-220c47a91505`; 16,823 input / 468 output; `$0.04205115` |
| LangSmith lifecycle | `afb5a4a0-4298-41be-8464-7022175c7acd` (`vcso_sdk_turn`, success) |
| LangSmith tool hook | `9613edb4-b227-40f5-b869-09906423f635` (`vcso_sdk_post_tool_use`, success) |
| Reload | narration, curated chip, and 5/5 plan all restored; no legacy `Show steps` control |

The first visual canary exposed narration disappearing at the existing completion reload. That proof
was not accepted. v0.6.42 added additive curated-segment persistence; the canary was repeated only
after both Vercel and Railway reported the exact commit successful, then the completion and full-page
reload gates passed.

## Flag-off control and locks

- After the canary, the flag was restored to disabled/default/global off with `test_user_ids=[]`.
- Authenticated flag-off prompt `Post-deploy smoke check. Reply only: READY.` completed on the legacy
  renderer: `Show steps` present, right-rail `Progress` absent, and no SDK surface activation.
- Context selection, source routing, registry compilation, tool execution, Deep Mode, planner logic,
  API calls, founder isolation, and `ai_usage_log` schema were not changed.
- `ai_usage_log` remains the separate 15-column metering ledger. The canary added its expected one
  SDK usage row; no metering migration or account-level quota work occurred.
- No raw payload or chain-of-thought appeared in the live DOM. The drill-down stops at curated text.

## Verification

- Focused SDK normalizer proof: `5 passed`.
- Backend `compileall` over `services`, `core`, and `main.py`: clean.
- Frontend production build: green (`2761` modules); only the standing large-chunk warning remains.
- `git diff --check`: clean for Phase C2 changes.
- Production Vercel v0.6.42: ready; Railway `api.architectospro.com`: exact commit status successful;
  `/api/health`: `ok=true`.
- Live plan/narration/token behavior, curated expansion, responsive containment, completion reload,
  full page reload, paired traces/usage/output, and flag-off rollback: pass.
- No migration was required: narration persistence is additive inside the existing JSON contract.

## Deferred by plan

- Rich subagent step-tree rendering waits for Phase D `parent_tool_use_id` events.
- Deep Mode plan/workspace reconciliation waits for Phase E.

## Stop condition

Phase C2 is complete. Do not begin Phase D without London direction. The harness root `ROADMAP.md`
remains untouched under the Phase G founder gate.
