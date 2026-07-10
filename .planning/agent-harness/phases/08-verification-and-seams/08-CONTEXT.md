# Phase 8 Context — Verification & Seams (Ep6 Closeout)

**Phase:** 08 of the Agent Harness (Episode 6) build — the closeout.
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; all of Phases 1–7 `0N-COMPLETION.md`;
canonical `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5 (L1–L21) + **§8** (post-Ep7 audit + sequencing
gate). This phase adds **no features** — it proves internal consistency and hands the live smokes to §8.

---

## Why this phase, and what it is

Prove the Ep6 build is internally consistent, honors the locked decisions, and is Ep7-ready —
**before** the post-Ep7 front-end audit and the consolidated live-credential smoke pass (§8). Scope
is **code-level** verification + assertions; the live-credential smokes are **deferred to §8 by L18**
(scaffold-first), not run here. Optionally run via a dedicated verification subagent (ROADMAP).

## What this phase is NOT
- **Not new features.** Verification + assertions + the §8 handoff checklist only.
- **Not the live-credential smokes.** Anthropic/GKE/browser/OS-Engine live runs belong to the §8
  consolidated pass (after the front-end audit), per L18 + the §8 sequencing gate. Phase 8 produces
  the checklist; §8 executes it.

## Scope — three checks

### A. Code-level end-to-end (all entry points → one task)
- The Monthly P&L anchor runs to **Review** and produces `artifact.html` from **each** entry point:
  Profile launch, Kanban card resume, VCSO `@Agent` (all resolve to one task object; differ only by
  `origin`).
- State machine: Ready→Running→Blocked(upload+clarify)→Running→Review→Done; revision re-enters
  Running; **no Running→Done skip**. Resumability: interrupt a `llm_batch_agents` step and a Blocked
  task; both resume from partial state.
- Graduation at Review registers a `domain_agent_task` artifact (lineage+provenance); `POST /promote`
  triggers `synthesize_from_task` + sets `promoted_to_kb`; nothing auto-promotes.
- Deep Mode: ON grants planning/workspace/sub-agent/ask-user; **OFF byte-for-byte unchanged**.

### B. Locked-decision assertions
| Check | Decision |
|---|---|
| No Deep Mode / open-chat surface in Domain Agents; VCSO `@Agent` = handle, not takeover | L14 |
| Trace is curated summaries only — grep for raw chain-of-thought leakage | L11 |
| Orchestration = Claude; no OpenAI `response_format`/OpenRouter primary path | L12 / C1 |
| Every model call emits `usage_events` tagged `surface` + `role` + `task_id`; deep usage rolls up under `virtual_cso` | L13 |
| Artifacts use the Ep4 sandbox export path scoping; agent artifacts NOT via N8N/Google-Docs | L20 |
| One `workspace_files` serving `owner_type` task **and** thread | L21 |
| Tasks first-class, not thread-coupled; editable todos Deep-Mode-only | C2 / C4 |

### C. Ep7 forward seams
- `tasks.step_results` + `artifacts.provenance` carry `source_refs` end to end for the anchor run
  (Ep7 can render citations with no re-plumbing).
- The L17 promotion trigger payload (`synthesize_from_task`) is well-formed (downstream may be stubbed).

## §8 handoff — the consolidated deferred-smoke checklist (do NOT run here; hand to §8)
- Live **Anthropic** task execution + Deep Mode turn (real key).
- Live **GKE/sandbox**: apply the deny-all egress **NetworkPolicy**, sandbox bridge end-to-end,
  and the deferred **DOCX export** (L20 richer format).
- **Authenticated browser** click-through of all surfaces against live Supabase.
- Live **OS Engine** promotion → wiki page + vector (L17 downstream).
- **Ep5 verification debt** (egress policy, live smokes, Python-stream flag flip) — folds in here (L18).
- Then the **front-end / UX audit + real-wiring pass** (§8.1) and the **consolidated cross-episode
  smoke** (§8.2) precede go-live.

## Success criteria (ROADMAP Phase 8 — VERIF-01…VERIF-03)
1. Anchor workflow runs end to end (code-level) from all three entry points; state machine +
   resumability + review gate hold.
2. All §B locked-decision assertions pass (or are logged with the §8 owner).
3. Ep7 seams verified; the §8 consolidated deferred-smoke checklist is written and complete.

## Open items
- **Verification subagent** — optional (ROADMAP suggests it for high-stakes verification); the
  execution agent may run the checks directly.
- **Where the checklist lives** — `08-COMPLETION.md` + a pointer from `STATE.md`; confirm it's the
  canonical §8 input.
