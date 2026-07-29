# 04B Delegation Return - Local Findings

**Date:** 2026-07-29
**Scope:** `_run_sdk_turn` local reproduction and capture-canary preflight only
**Live changes:** none. No flag read/write, deployment, activation smoke, or canary was run.

## Production-path probe

Asset: `python-backend/scripts/probe_production_sdk_turn_return.py`

The probe calls the real production `_run_sdk_turn`, production option compiler, granular in-process
worker grants, production hooks, and either the production thread-plus-`queue.Queue` SSE bridge or a
plain asyncio driver. The six granted tools are deterministic local stubs. Child rows, steps, sources,
and completion writes use an in-memory evidence store. The hook-cost arm adds a real loopback HTTP POST
inside each `SubagentStart` insert.

The local runtime matched the handoff: Claude Agent SDK `0.2.118`, bundled Claude Code CLI `2.1.209`,
model `claude-sonnet-4-6`.

## Observations

| Factor | Controlled shape | SubagentStop | Agent result in-band | Iteration termination | Timing |
|---|---|---:|---:|---|---|
| Isolated control | Existing one-worker harness | 1/1 | 1/1 | successful result | 22.82 s total |
| Fast tool baseline | 0.2 s tools, threaded bridge, no hook network, small prompt | 2/2 | 2/2 | `ResultMessage` | starts 25.18/27.41 s; stops +19.88/+17.04 s; terminated 57.47 s |
| Tool latency | 2.0 s tools; otherwise baseline | 2/2 | 2/2 | `ResultMessage` | starts 22.92/24.51 s; stops +25.13/+24.67 s; terminated 59.15 s |
| Threaded bridge | Same slow-tool turn through production bridge | 2/2 | 2/2 | `ResultMessage` | terminated 59.15 s |
| Plain asyncio | Same slow-tool turn without bridge | 2/2 | 2/2 | `ResultMessage` | starts 24.08/25.49 s; stops +25.68/+25.26 s; terminated 84.38 s |
| Hook network cost | Slow tools plus loopback HTTP write on each `SubagentStart` | 2/2 | 2/2 | `ResultMessage` | writes 1.29/0.77 s; stops +25.07/+26.93 s; terminated 90.67 s |
| Prompt scale | ~308k characters of inert context, otherwise slow threaded baseline | not reached | not reached | startup exception | `CLINotFoundError` at 1.95 s, before any SDK message or hook |

The fast, slow, bridge, plain-asyncio, and hook-network arms all exercised the production access gate
and successful granted tool calls. Every started worker fired `SubagentStop`; every Agent result appeared
as a completed, non-error in-band `ToolResultBlock`; every successful arm ended on a non-error
`ResultMessage`.

The production-scale prompt arm is **indeterminate**, not a failed return. The probe's version check found
the bundled `claude.exe` as `2.1.209`, but SDK startup then raised `CLINotFoundError` for that same path
before yielding a message. The file was present when checked after the stop. Per the stop-on-first-failure
rule, the arm was not retried.

The sandboxed first control attempt also failed before delegation with API `ConnectionRefused`. Re-running
with network permission made the existing isolated control return in-band. This was a local execution
permission condition, not a delegation-return observation.

Local LangSmith imports were absent and trace writes failed open in every successful production-path arm.
That did not prevent stops or in-band return.

## What the observations establish

1. Multi-second tool latency alone did not reproduce the production failure.
2. The production threaded queue-to-SSE bridge did not drop worker lifecycle or Agent result messages.
3. Replacing the bridge with plain asyncio did not change return semantics.
4. A blocking network write during `SubagentStart` did not stall lifecycle completion.
5. Production-sized prompt/context remains unobserved because the local CLI failed before startup.

The local matrix therefore does not yet justify claiming the cause is exclusively Railway environmental:
three production-only differences are negative locally, while prompt scale remains open.

## Capture-canary preflight

Assets:

- `python-backend/scripts/arm_native_capture_canary.py`
- `python-backend/scripts/verify_native_activation_smoke.py`
- `python-backend/unit_tests/test_native_capture_preflight.py`

The arming script:

- requires a verified-dark starting row;
- cache-busts `/api/health` and requires the expected deployed SHA;
- writes `is_enabled` plus the complete merged settings object in one row update;
- replaces **both** `test_user_ids` and `diagnostic_user_ids` with the same one-founder list;
- enables native model-driven mode and bounded stream capture;
- disables unrelated diagnostic injections and `enabled_for_all`;
- reads the row back and asserts every required value;
- provides a paired atomic disarm/readback that empties both allowlists.

The activation verifier fails unless the throwaway parent run is completed and carries:

- `sdk_phase=04B-D`;
- `native_subagent_mode=true`;
- a consistent, non-empty `available_subagents`;
- capture-enabled attribution;
- a present, non-empty `sdk_raw_stream_capture`.

Focused verification: `8 passed`. The scripts were not pointed at live Supabase, and the smoke was not
spent.

## London checkpoint

Recommendation: do not take the async-native fork from this evidence. The local results clear latency,
the bridge, and hook network cost as sufficient causes, but prompt scale is still an unobserved factor.
The structural preflight now exists for the single authorized capture canary if London chooses that next
diagnostic step. No capture canary is authorized or run by this report.
