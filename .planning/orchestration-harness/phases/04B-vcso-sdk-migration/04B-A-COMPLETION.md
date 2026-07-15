# 04B Phase A Completion — Streaming Spike + SDK Proof-of-Loop

**Completed:** 2026-07-15  
**Decision:** **GO on Q1 — clean incremental assistant streaming is available.**  
**Checkpoint:** Awaiting London before Phase B.  
**Production state:** `vcso_sdk_loop` disabled, `enabled_for_all=false`, zero enrolled founders.

## Shipped dark

- Commit `af970a2e` (`v0.6.29`) adds an isolated Python Agent SDK adapter behind
  `vcso_sdk_loop`; the hand-rolled path remains the flag-off fall-through.
- Claude Agent SDK `0.2.118` and MCP `1.28.1` are pinned in the backend requirements.
- The SDK receives the existing selected founder context and one existing read-only registry tool,
  `wiki_search`; it does not replace retrieval, routing, the registry, workers, or persistence.
- SDK `StreamEvent` text deltas normalize to the existing `token` SSE event. Tool use normalizes to
  curated `step`/`tool_call`/`tool_result` events with empty/sanitized payloads. No raw JSON or
  chain-of-thought is surfaced.
- One sanitized `PostToolUse` hook emits `vcso_sdk_post_tool_use` to LangSmith with the same run ID
  used by the exact `ai_usage_log` row.
- Migration `20260715_orchestration_harness_vcso_sdk_loop.sql` creates only the default-off flag row.

## Live grounding and proof

The live preflight confirmed `platform_ai_settings` uses `is_enabled` plus
`settings.{test_user_ids,enabled_for_all}`. P1–P3 were single-founder canaries, P4 was disabled with
zero enrollment, `mcp_connections` had zero rows, and `vcso_sdk_loop` did not exist before the Phase A
migration.

Railway deployed `af970a2e` successfully and `https://api.architectospro.com/api/health` returned 200.
An initial canary attempt occurred while Railway still reported the backend deployment pending; paired
DB evidence correctly showed the old hand-rolled loop, so it was rejected as proof and repeated only
after the backend status became successful.

### Flag-off control

- Thread: `fcbcf9d7-7c2a-45f9-ba2d-23349e9bb638`
- Prompt/answer: `Reply with exactly READY.` → `READY.`
- Run: `6ea45422-84e2-4015-b72b-5bfdb8cc041c`
- Schema/capability: `vcso_tool_loop_v1` / `vcso_chat_tool_loop`
- Result: no SDK run or SDK usage row; intent and router continued on their existing paths.

### Founder-only SDK canary

- Thread: `ac11f2bf-5c3f-414e-b107-cd0008780957`
- SDK run: `0e3c41b8-9447-4894-8ad2-8577b7929473`
- SDK session: `aca31673-dcf6-4ea2-8b5c-a9a30a8a2ede`
- Persisted schema: `vcso_sdk_spike_v1`
- Persisted streaming mode: `partial_text_delta`
- Tool proof: one curated `wiki_search` step; five normalized sources; no raw payload displayed.
- Output: one-sentence cited answer naming Northlight Digital; assistant message
  `40c3cc9e-44e2-4392-97c8-366ffea19443`.
- Usage row: `7d053497-6dec-4cde-b419-e08808864c6a`, capability `vcso_sdk_loop`, model
  `claude-sonnet-4-6`, 6 input / 100 output tokens, cost `$0.03761605`, exact run-ID match.
- LangSmith: trace `959afc79-e0e9-4522-960b-b4ed96e35947`, name
  `vcso_sdk_post_tool_use`, successful, exact `run_id` and `capability_key` match.
- UI/SSE: London completed the authenticated browser turn through the unchanged frontend contract;
  the live run persisted `partial_text_delta` rather than message-level or fixed-width chunks.

Local SDK proof additionally observed assistant deltas `Stream` and ` works confirmed.` on a minimal
call, then two deltas around a bounded in-process read-only tool call. This confirms that the SDK is
forwarding provider text deltas, not applying the hand-rolled 160-character chunker.

## Verification

- Focused Phase A tests: `3 passed`.
- Backend `compileall`: clean.
- Backend dependency check: no broken requirements.
- Full backend `main` import: clean.
- Production health: 200 after Railway marked the backend commit successful.
- Rollback read-back: `is_enabled=false`, `enabled_for_all=false`, `test_user_count=0`.
- Frontend source was not changed; its existing SSE schema remains the contract.

## Acceptance read-back

1. **Flag off unchanged:** pass — forced live control used the hand-rolled loop and created no SDK row.
2. **Flag-on SDK turn and real streaming:** pass — authenticated founder canary completed with
   `partial_text_delta`, one curated tool step, cited persisted output, and no raw payload/CoT.
3. **Paired observability:** pass — trace `959afc79…` and usage `7d053497…` share SDK run
   `0e3c41b8…` and capability `vcso_sdk_loop`.
4. **Q1 decision:** **GO.** No message-level fallback or masking revision is required for Phase B.
5. **Build checks and records:** pass. The harness root `ROADMAP.md` is intentionally untouched under
   the explicit Phase G founder gate.

## Stop condition

Phase A is complete. Do not start Phase B until London accepts this go/no-go read-back. The live SDK
flag remains dark and the hand-rolled VCSO remains the production path.
