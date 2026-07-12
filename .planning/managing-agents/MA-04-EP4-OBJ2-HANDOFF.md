# MA-04 Ep4 — Objective 2 Handoff: GKE Sandbox Execution (the pivotal gate)

> For the Ep4 agent, after Obj-0 + Obj-1 closed. Baseline **v0.5.44**. Work-from-live, brains/engine split,
> stop at the Obj-2 gate before the artifact objectives.

---

Obj-0 and Obj-1 are closed. Proceed to **Objective 2 — GKE sandbox execution.** This is the pivotal gate:
Objectives 4 and 5 (artifacts, and the capstone invoke-skill → sandbox → artifact loop) are built entirely on
the sandbox actually working in prod, and the sandbox smokes were deferred under L18 — so this is where any
GKE credential/config/networking gap surfaces.

## What the sandbox is FOR (test against purpose, not a toy)
The sandbox exists for two things — verify both, not just "a pod runs `print()`":
1. **Sub-agent compute / deeper analysis** — a sub-agent writes and runs its own code to answer something that
   can't be done in one API turn (multi-step reasoning, real computation over data).
2. **Document/artifact production** — turning an agent conversation's output into an actual report/document,
   rendered in the sandbox and written back into Supabase as an artifact.
(Locked design: L3 shared sandbox for VCSO + Domain Agents; L4 artifact creation is sub-agent-driven and
sandbox-executed. Domain Agents are the *other* consumer but that surface is Ep6 — test through VCSO here.)

## Trigger: Virtual CSO chat (now that the UI streams)
The chain we want to see live: **VCSO turn → spins up the `sandbox_execution_agent` (sub-agent) → sandbox
executes code in a real GKE pod → produces an artifact → written to Supabase → delivery card in the thread.**
Phase 7 wired `requires_sandbox` skills to trigger the sandbox agent from VCSO. **First task: identify the exact
VCSO path that reliably fires the sandbox** (a `requires_sandbox` skill by `@slug`, or a query that inherently
needs code execution) and hand the founder the precise prompt to use — don't rely on the model happening to choose it.

## The test (Northlight-coherent, exercises both purposes)
Use the already-ingested Northlight roster (`SEED - Northlight Client Roster and Revenue`). Target VCSO interaction:
> *"Analyze Northlight's client roster: calculate client-revenue concentration (top-2 client share and per-industry
> mix) and produce a short concentration-risk report I can download."*
This forces the sandbox to (1) **compute** the concentration over real data and (2) **render a document** back to
Supabase — both purposes in one coherent flow, congruent with the fictitious agency.

## Verify (by outcome — the founder drives VCSO on live; you check MCP + LangSmith)
- **Sub-agent spun up:** the VCSO turn invokes the `sandbox_execution_agent` (visible via `agentSteps` /
  `agent_delegation_runs`).
- **Sandbox executed in prod:** `execute_code` ran in a real GKE pod, with a **persistent session** across calls
  (variables/imports survive); confirm GKE creds/config are live in **Railway prod**, not just present in code.
- **Evidence:** a completed delegation run + usage rows (Supabase MCP), a **LangSmith trace** of the execution
  loop in `ArchitectOS-pro`, and the founder's live report.
- **Artifact half (basic):** a document artifact is produced and written to Supabase (`artifacts`), and a delivery
  card appears in the thread. *Deep artifact UX — render fidelity, message linkage, reload, library — is Obj-4/5;
  here just confirm the sandbox's second purpose works at a basic level.*

## Scope discipline
**Do NOT build the Ep5 sandbox egress NetworkPolicy** — flag-only. (It's a Kubernetes deny-all-egress rule that
would stop sandbox pods reaching the internet — a security boundary for when real users run code; the sandbox
likely has open egress today, which is a real **pre-go-live security item, tracked for Ep5**.) Note any GKE
networking finding; don't fix it here. Stay out of Ep5/Ep6.

## How you work
Work-from-live (`architectospro.com`; founder logged in as seeded `cd490873-…`). Brains/engine split — never boot
the backend; the founder runs the VCSO interaction and reports; you write code, read the DB via **Supabase MCP**,
check **LangSmith**, interpret. `main` → auto-deploy → verify live; gate on green deploys. **Fix-in-place**
contained bugs; **discover-and-report** anything structural (esp. if GKE isn't wired in prod — that's a
report-and-scope-separately finding, not something to silently block Ep4). **Commit version-tagged from v0.5.44.**
Never read/echo secrets. Honor locks L1–L26.

## Pass criterion / gate
Obj-2 passes when the **sandbox demonstrably executes code in prod** (compute purpose proven, with a run row +
LangSmith trace) **and** the same flow produces a document artifact back to Supabase (artifact purpose at a basic
level). **Stop at the Obj-2 gate and report** before the deeper artifact objectives (4/5). If GKE turns out not to
be wired in prod, report it as a scoped finding rather than proceeding.
