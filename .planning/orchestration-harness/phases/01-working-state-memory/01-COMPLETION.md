# Phase 1 Completion Evidence — Working-State Memory + Bounded Assembly

**Date:** 2026-07-13  
**Status:** Founder checkpoint — implementation and live acceptance passed; paired LangSmith trace
readback remains pending; default flip not authorized.

## Scope delivered

- `vcso_chat_threads.working_state` holds the locked `decisions`, `open_questions`, `findings`, and
  `known_unknowns` families with bounded normalization and founder-scoped access inherited from the
  thread row.
- `assemble(working_state, current_move, budget)` is a discrete, token-budgeted seam. It composes a
  bounded system prefix, working state, the two-source wiki selection, optional whole-message tail,
  and the current move. Oversized optional tail messages are omitted instead of forcing fallback.
- Any assembly error quarantines and downgrades to the existing `_build_context` path. Compaction
  remains present as fallback and is not the flag-on default.
- Worker-tier `afterTurn` resolves `tier_worker` to Claude Haiku, caps prompt/output/timeout, updates
  only the thread working state, and fails open. Its MA-06 usage role is `utility`, with the precise
  `vcso_working_state_after_turn` capability key.
- `agent_annotations` supports capped founder-owned notes for `wiki_component`, `tool`, and `skill`.
  Registry-native `annotate` attaches or clears notes, reports `knowledge_base_write: false`, and has
  no routing tier. Re-injection is opt-in and explicitly wrapped as untrusted metadata.
- No router, intent read, planner, delegation change, feeder, MCP, or knowledge-base write was added.

## Shipped commits

- `1d8a4a64` — Phase 1 substrate and migrations
- `39a4b428` — bounded live assembly and worker timeout
- `98b37bd5` — scoped LangSmith trace metadata
- `7e035ba1` — worker usage accounting aligned to the MA-06 `utility` role
- `80446e2a` — oversized recent-message tail remains bounded instead of falling back

## Live schema and isolation

Supabase project: `pwacpjqkntnovndhspxt`.

- `working_state jsonb` is live on `vcso_chat_threads`.
- `agent_annotations` is live with founder-scoped policies and a per-resource active-note cap.
- Authenticated RLS replay for proof annotation `94030102-4e25-4b6c-980f-fe021babf4d7` returned one
  row for founder `cd490873-99aa-4533-9240-f0aa04deb54f` and zero rows for another founder UUID.
- Worker registry proof attached annotation `5b09287c-c223-4752-b3d8-49999dc051ae` with
  `created_by=phase1_worker_proof`, then cleared one row. Both attach and clear returned
  `knowledge_base_write: false`.
- Temporary annotations were deleted after verification.

## Working-state and worker proof

Live thread `7c48ddad-22bb-4069-9bb9-59bc4cdfe8fd` populated all four families after the first turn
and updated them across later turns. The persisted state retained cited concentration/margin findings,
sequenced decisions, open questions, and known unknowns under the configured caps.

Recorded worker events:

| Capability | Role | Model | Input | Output | Time UTC |
|---|---|---|---:|---:|---|
| `vcso_working_state_after_turn` | `utility` | `claude-haiku-4-5-20251001` | 2,305 | 521 | 17:57:39 |
| `vcso_working_state_after_turn` | `utility` | `claude-haiku-4-5-20251001` | 2,896 | 376 | 18:01:16 |

The earlier live accounting gap was traced to an invalid `role=worker` insert against the existing
MA-06 role constraint; `7e035ba1` corrected the label without changing tier selection.

## Cost proof

Legacy control thread: `a290f99e-0242-4305-8919-d245efa2c35f`.  
Working-state thread: `7c48ddad-22bb-4069-9bb9-59bc4cdfe8fd`.

| Question | Legacy first main input | Working-state first main input | Reduction |
|---|---:|---:|---:|
| Concentration rising while margin compresses | 17,338 | 8,742 | 49.6% |
| Get below the 30% concentration guardrail; sequence first move | 18,234 | 8,062 | 55.8% |
| Unknowns and evidence that would change the recommendation | 20,350 | 8,786 | 56.8% |
| **Total** | **55,922** | **25,590** | **54.2%** |

Across the complete tool loops, legacy main input was 178,476 tokens and the comparable working-state
runs used 141,415 tokens, a 20.8% reduction despite route/tool-call variability. Main output was
7,222 vs. 7,256 tokens, so the saving did not come from suppressing the answer.

## Quality proof

The fixed live set passed the same founder-facing rubric on both paths: grounded agency numbers,
clear verdict, sequenced action, standing guardrail, named risk, and explicit evidence gaps.

- Q1 tied top-two concentration (~40%), 18.5% operating margin, and 3.6 months runway to a 90-day
  forecast and diversification sequence.
- Q2 preserved continuity and sequenced delivery systematization before targeted pipeline expansion.
- Q3 named contract durability, pipeline win-rate/cycle, and margin trend as the three decision-leverage
  unknowns, with concrete evidence that would change the recommendation.

Persisted assistant outputs in `vcso_chat_messages` contain the cited answer bodies; the browser showed
the same structured responses after streaming. No regression was observed against the legacy control.

## Fail-open proof

The founder-only test budget was temporarily set to 800 tokens, below the bounded system prefix, to
force an assembly error. Thread `1c4e63e8-95ae-4fbd-8a72-b8946b3cc2f8` still completed on the legacy
path; its first main input was 16,336 tokens, consistent with legacy rather than the 8.1–8.8K bounded
window. The budget was immediately restored to 6,000.

## Annotation persistence and untrusted re-injection

Thread A attached the note `Phase 1 cross-thread proof — confirm margin trend before changing the
sequence.` to `wiki_component:financial_context` through the registered `annotate` tool. A new Thread
B (`d6a2f7ce-b313-4d0a-b53c-1d1ce921f1ce`) received the note through opt-in assembly and explicitly
treated it as provenance-independent, untrusted metadata rather than an instruction. RLS replay proved
same-founder visibility and other-founder invisibility. The proof note was then removed.

## Verification

- `.venv-kb-nav\\Scripts\\python.exe -m pytest python-backend\\tests\\test_vcso_working_state.py -q`
  — 9 passed.
- `python -m compileall -q -x '[/\\](venv|\.venv-kb-nav)[/\\]' python-backend` — exit 0. The only
  message was the pre-existing inaccessible `.pytest_cache` listing warning.
- No `src` file changed; frontend build was not required.
- Supabase advisor output contains pre-existing project-wide notices; no Phase 1 founder-isolation
  failure was found. Direct RLS replay is the acceptance evidence for this phase.

## Outstanding London checkpoint

Scoped `user_id`, `thread_id`, and `capability_key` metadata is deployed around main and afterTurn
LangSmith calls (`98b37bd5`). A direct LangSmith query for the live thread could not be completed:
the available local credential returns HTTP 401 `Invalid token`. No credential workaround was used.

Before deciding the default flip, restore authorized LangSmith read access and attach the paired trace
IDs for the live working-state thread to this file. The cost, output, schema, RLS, annotation, worker,
and fail-open evidence is otherwise complete. The production state remains:

- `is_enabled=false`
- `test_user_ids=[]`
- `enabled_for_all=false`
- `annotations_enabled=false`
- `assembly_token_budget=6000`

Do not flip the default without the London decision, and do not start Phase 2 from this checkpoint.
