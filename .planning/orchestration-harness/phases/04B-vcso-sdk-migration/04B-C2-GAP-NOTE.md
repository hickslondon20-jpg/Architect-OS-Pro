# Phase C2 Current → Target Gap Note

**Written:** 2026-07-15  
**Scope:** SDK-U1 only — live frontend/SSE render compared with the founder's current-state and approved target screenshots.

## Live seam

The Python endpoint already emits the stable VCSO SSE vocabulary. `lib/virtualCsoApi.ts` parses that
stream, `VirtualCSOWorkspace.tsx` owns the live turn state, and `MessageBubble.tsx` /
`AgentStepsPanel.tsx` render the result. The SDK flag is still dark on live (`is_enabled=false`,
`enabled_for_all=false`, no test founders), so C2 must remain confined to that canary path.

## Event map

| SSE event | Current render | C2 target render |
|---|---|---|
| `ready` | Creates the user message and an empty assistant message; loads initial steps; shows a temporary routing notice below the composer. | Opens one live assistant turn, seeds the compact activity flow, and initializes the right-hand progress rail without exposing routing internals. |
| `step` | Ignored by the frontend. | Upserts a compact, human-readable activity chip from curated `title`/`summary`; no payload display. |
| `tool_call` | Adds a running row inside the large beige Steps accordion. Its input can later be expanded as formatted JSON. | Adds a small running chip in the conversation flow: tool label + one-line curated summary. Expansion contains curated detail only. |
| `tool_result` | Completes the accordion row and retains serialized output for an expandable Results block. | Completes the matching chip in place. Expansion shows the curated summary and safe source count/labels only—never input/output JSON. |
| `token` | Appends every text delta to one assistant markdown body below the full trace block; narration and final answer have no presentation distinction. | Streams text in arrival order. Additive `channel: narration` deltas render as lighter interstitial prose between chips; existing/plain tokens remain the answer stream for backward compatibility. |
| `heartbeat` | Parsed transport-side but ignored visually. | Keeps the active chip visibly alive with a restrained running state; elapsed timing remains secondary and no backend payload is exposed. |
| `ask_user` | Ignored by the standard frontend consumer. | Presents the curated founder question as the active turn state and marks the plan paused. Full Deep Mode resume behavior remains Phase E. |
| `todos_updated` | Ignored. | Reconciles the numbered right-hand progress rail from founder-scoped todo state; active/completed/pending states update in place. |
| `workspace_updated` | Ignored. | No C2 workspace browser. May provide a small curated activity update only; Deep Mode workspace specifics remain Phase E. |
| `done` | Replaces the temporary assistant message with the persisted message and its full blocky trace; updates sources. | Finalizes the flowing turn and plan states while preserving the same persisted answer/source handoff. |

`sub_agent_step` and rich parent/child trees remain deliberately unchanged until Phase D supplies the
native `parent_tool_use_id` relationship.

## Material gaps to close

1. **Hierarchy:** the trace currently precedes and visually outweighs the answer. The target makes
   narration/answer the reading spine, with tool evidence compact and optional.
2. **Disclosure:** current expansion renders raw-shaped Input and Results blocks. C2 must remove that
   founder-facing payload path and stop at curated summaries and safe source metadata.
3. **Continuity:** assistant prose is accumulated into one body, so interstitial narration cannot sit
   between the actions it explains. The SDK normalizer needs one additive narration marker.
4. **Plan visibility:** `todos_updated` is emitted but discarded, and the existing right rail is
   sources-only. The target keeps a numbered, living progress panel visible beside the turn.
5. **Density and motion:** the current nested parchment accordion is tall and templated. The target is
   a calm Cloud-on-Parchment reading surface with compact chips, restrained motion, and a persistent
   secondary rail in ArchitectOS Obsidian/Brass/Geist language.

## Locks carried into implementation

- No raw JSON, raw tool payloads, hidden reasoning, or chain-of-thought in the UI.
- The existing SSE names remain valid; C2 may add optional fields only.
- The SDK flag/canary remains the rollout boundary; flag-off behavior is unchanged.
- No loop, retrieval, registry, API-route, founder-isolation, or persistence behavior changes.
- Subagent trees wait for Phase D; Deep Mode plan/workspace authority waits for Phase E.
