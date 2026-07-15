# 04B Phase B Completion — Standard VCSO SDK Loop

**Completed:** 2026-07-15
**Decision:** **PASS — matched canary cost and quality are parity-or-better.**
**Checkpoint:** Phase B complete; Phase C has not started.
**Production state:** `vcso_sdk_loop` disabled, `enabled_for_all=false`, zero enrolled founders.

## Shipped behind the flag

- Commit `ce6731f2` (`v0.6.31`) routes standard non-Deep, non-planner VCSO turns through the
  Claude Agent SDK only when `vcso_sdk_loop` is enabled for that founder. Flag-off, Deep Mode,
  resume, and planner traffic retain their existing paths.
- The existing context-selection pipeline still chooses working state, tiered sources, wiki
  components, IP, and the exact registry tool set. The SDK owns only the within-turn message/tool
  lifecycle and native compaction.
- Existing registry definitions compile dynamically to bounded in-process SDK MCP tools. Built-in
  SDK tools are not granted, founder-scoped `ToolExecutionContext` is preserved, and the turn is
  capped at six rounds and `$0.25`.
- SDK `StreamEvent` text deltas normalize to the existing SSE `token` event. Tool events normalize to
  curated steps with empty input/output summaries. No raw tool JSON or chain-of-thought reaches the
  frontend.
- The planner path's fixed 160-character pseudo-stream is deleted. Its already-complete answer is now
  emitted once; no new frontend contract was introduced.
- One `vcso_sdk_turn` lifecycle trace and one exact `ai_usage_log` row are emitted per SDK turn.
  Successful `PostToolUse` hooks emit sanitized `vcso_sdk_post_tool_use` traces.

## Verification before live proof

- Focused SDK loop tests: `4 passed`.
- Broader VCSO suite: `45 passed, 12 skipped`.
- Backend `compileall`: clean.
- Full backend `main` import: clean.
- Frontend source was not changed.
- Production deploy: Railway commit status successful; `/api/health` returned 200.
- Flag read-back before control: disabled, global/default off, zero enrollment.

The live runtime dependency check also found that the tracked local virtual environment still held
MCP `1.13.1`, while the committed requirements correctly pin MCP `1.28.1` for Agent SDK `0.2.118`.
An isolated MCP `1.28.1` proof and then the real dynamic adapter both completed successfully. The
tracked environment was restored; no dependency drift was committed.

## Matched authenticated proof

London ran three prompts in separate standard-mode threads first with the SDK dark, then with only the
founder account enrolled. All six answers completed through the unchanged UI. Deep Mode was false for
every message.

| Case | Control run | SDK run | Control footprint | SDK footprint | SDK cost | Quality result |
|---|---|---|---:|---:|---:|---|
| Sprint goal + initiative | `926ad558-34de-40e1-ba7e-26facab928a6` | `2d2f78bc-c9be-4a83-a474-0e1fb27ea3b1` | 11,653 | 7,552 | `$0.0349365` | Better: SDK supplied the missing initiative name and retained both platform-record citations. |
| Northlight delivery model | `2eb31531-902d-4a5e-9822-3eaf84bb7ff6` | `b67e79ad-24fc-4865-85de-f75fb67913e6` | 40,137 | 35,643 | `$0.05270675` | Parity: integrated delivery, consistency gap, playbooks, and founder dependency all remained grounded; SDK used three registry tools. |
| Productized retainer | `aed80426-ba9c-4ac4-95ee-8b73d4079563` | `3a3b1ea0-b9cb-43b5-98f9-a46d6a6eeb2b` | 30,429 | 7,307 | `$0.0306272` | Parity: packaging, systematization, playbook, and founder-dependency guidance all remained cited. |

The control footprint is the sum of recorded main-model input and output tokens across its manual
rounds. The SDK footprint uses the conservative full SDK input accounting, including cache-read and
cache-creation tokens, plus output. Combined control footprint was **82,219** tokens; combined SDK
footprint was **50,502**, a **38.6% reduction**. Exact SDK cost across the set was **$0.11827045**.
Legacy control rows do not store `cost_usd`, so no unsupported historical dollar figure is claimed.

Two SDK turns encountered the existing intent reader's fail-open path and safely used the full context
profile. This did not change source selection ownership or answer quality and is recorded rather than
silently treated as an SDK result.

## Paired observability and persisted contract

Each SDK run persisted `schema_version=vcso_sdk_standard_v1`,
`streaming=partial_text_delta`, `reasoning_visibility=summary_only`,
`sdk_usage_recorded=true`, and `sdk_turn_trace_emitted=true`.

| SDK run | Turn trace | Usage row | Tool-hook traces |
|---|---|---|---|
| `2d2f78bc-c9be-4a83-a474-0e1fb27ea3b1` | `f9a3ec7e-27d1-43d2-87a4-df3647057218` | `9395c14a-a41e-4b1e-a163-d0cbb037dce6` | 0 — preselected platform records were sufficient. |
| `b67e79ad-24fc-4865-85de-f75fb67913e6` | `5f8f3b5c-0fe8-459c-8636-d1f7219ce3bf` | `14b0ed75-8bd0-4210-82ef-4ebedd1f9911` | `a8a395ea…`, `b95d53ba…`, `821c2f29…` for `kb_grep`, `kb_glob`, and `kb_read`. |
| `3a3b1ea0-b9cb-43b5-98f9-a46d6a6eeb2b` | `3cc50d56-119f-437f-9b31-54ba048f92aa` | `fb57c3ab-223a-4dff-999b-7d304574441a` | 0 — preselected compiled sources were sufficient. |

All listed LangSmith traces completed successfully and carry the exact corresponding run ID. The
document lookup persisted curated tool steps with `{}` input/output summaries and source counts only.
The UI consumed the existing SSE contract with no frontend change.

## Acceptance read-back

1. **Strangler behavior:** pass — global/default remained off; only the named founder was enrolled;
   flag-off/Deep/planner paths remain hand-rolled.
2. **Selection/lifecycle split:** pass — ArchitectOS selection is unchanged; SDK owns within-turn
   messages, tool results, and compaction.
3. **Streaming/UI contract:** pass — live `partial_text_delta` normalized through the existing SSE;
   the 160-character fake is removed; no frontend source changed.
4. **Observability:** pass — three of three SDK turns have exact successful turn-trace/usage pairs;
   all three live registry tool uses have successful sanitized hook traces.
5. **Cost + quality:** pass — combined token footprint fell 38.6%, exact SDK spend was recorded, all
   quality checks remained grounded, and the record lookup improved.
6. **Rollback:** pass — `is_enabled=false`, `enabled_for_all=false`, `default=false`, and
   `test_user_ids=[]` after proof.
7. **Records:** pass — this completion, the 04B roadmap, harness state, and Pro Suite progress are
   updated. The harness root `ROADMAP.md` remains untouched under the Phase G founder gate.

## Stop condition

Phase B is complete. Do not begin Phase C without London direction. The standard production VCSO is
back on the hand-rolled path while the proven SDK implementation remains available behind its dark
flag.
