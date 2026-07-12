# Managing-Agent Scope — MA-04: Episode 4 (Agent Skills & Code Sandbox) Live-Verification

> Episode 4 = the **artifact-production engine**: skills + building-block files + code sandbox → artifacts.
> Live-verification episode (Ep4 is already built, 7 phases). Same method as MA-02: two-rung scoring,
> fix-in-place vs. discover-and-report, LangSmith standing bar, stage gates, incremental (not one-shot).
> **Work from live** (`architectospro.com`); commit version-tagged from **v0.5.32**. Honors locks L1–L26.

---

## Mission
Prove the built Ep4 runs live end-to-end: the **skills system**, the **GKE code sandbox**, **persistent tool
memory**, and **artifacts** (the sub-agent → sandbox → artifact flow). Move Ep4 from backend-complete →
**backend-live-verified**. Discovery, not confirmation; fix-in-place contained bugs, discover-and-report anything
structural. Stop at the Ep4 checkpoint. Do **not** start Ep5.

**Ep4 locked decisions (honor):** L2 skills are not domain-scoped (soft tags); L3 the sandbox is shared by
Domain Agents (execution + artifact generation) and Virtual CSO (execution to answer/fetch); L4 artifact
creation is sub-agent-driven and sandbox-executed (skills orchestrate sub-agents → sandbox → artifact).

## Prerequisites / environment
- **Work from live.** No local PowerShell/backend smokes. Verify via the live app UI (`architectospro.com`,
  logged in as the seeded `hicks.london25` / `cd490873-…`), **Supabase MCP** for DB, and **LangSmith**
  (`ArchitectOS-pro`) for traces. `main` → auto-deploy → test live; gate milestones on green deploys.
- **GKE sandbox** must be live in prod (this is the first episode that exercises real code execution).
- **Standing LangSmith bar:** sandbox-execution + skill-synthesis (guided-draft) LLM calls must emit traces.
- **Brains/engine split:** the founder drives the live UI + reports; the agent writes code, reads the DB via
  MCP, interprets. Never read/echo secrets. **Commit after every milestone**, `vX.Y.Z` (from v0.5.32).
- Seeded account is a **non-admin founder** (admin is `4ef8c0e3-…`); it should see the ~6 global skill packs +
  create its own private ones.

## Method
Derive each check from the Ep4 phase docs (`.planning/skills-sandbox/phases/…` — Phase 1 schema/storage, Phase 2
persistent tool memory, Phase 4 + 4.4 skill CRUD/guided creator/UI, Phase 6 artifacts/delivery, Phase 7 sandbox
tool integration). Score each on two rungs — **backend-live-verified** vs. **usable** — and log front-end gaps
as **§8 items**, not Ep4 failures. Timebox to earmarked enablements.

## Objectives (ordered, with stage gates)

**0. Initial audit + fix-it batch.** Audit what's wired vs. mock across the Skills & Plugins workspace, the
sandbox path, and artifacts; surface contained bugs. Fix-in-place the contained ones; report structural findings.
Also (quick carry-forwards): confirm **auto-ingestion works for all formats** (upload a PDF/DOCX/CSV/XLSX on live,
confirm auto-ingest → Complete — not just HTML/MD), and clean up the `ep2-*-smoke` test docs from the KB.
**→ Stage gate: report the audit + fix-it batch before deep work.**

**1. Skills system (live UI + DB).** Via the Skills & Plugins workspace + VCSO rail: skill **CRUD** (create a
private skill, edit, delete); **import/export** SKILL.md ZIP; the **guided creator** (direct-Anthropic
`/api/skills/guided-draft` — confirm a LangSmith trace); **global vs private** split (sees globals + creates
private); **building-block files** (`skill_files` bucket + metadata); VCSO ChatRail **browse/search + insert
`@slug`** into the composer. **→ Stage gate.**

**2. Sandbox execution (GKE, live).** `execute_code` runs Python in a real GKE pod with a **persistent session**
across calls; the `sandbox_execution_agent` bounded tool-use loop (`execute_code`, `read_skill_file`) runs and
persists a completed run + usage. Confirm GKE creds/config are live in prod. **→ Stage gate: sandbox proven
before the artifact flow.**

**3. Persistent tool memory (Phase 2).** Tool results survive across turns; `agent_delegation` steps reconstruct
on reload; steps stream early (`agentSteps` on `ready`).

**4. Artifacts end-to-end (Phase 6).** Sub-agent → sandbox → **artifact**: artifact schema/storage (`artifacts`
bucket/table + RLS), the sandbox file-extraction fallback (exec/base64 when `copy_from_runtime` is unreliable),
the Reader renders `artifact:{uuid}`, the inline delivery card, and the artifact **links to its chat message**
(live turn + on reload) and appears in the reader/library.

**5. Sandbox tool integration — the capstone flow (Phase 7).** A `requires_sandbox` skill invoked from the
Virtual CSO triggers `sandbox_execution_agent` → runs in the sandbox → **produces an artifact** → links to the
chat message → appears in the reader. Prove the full **invoke-skill → sandbox → artifact → message → reader**
loop live.

## Deliverables (then STOP)
Ep4 Enablement Matrix (two-rung) · fix-it batch committed · sandbox + artifact capstone flow verified ·
carry-forwards (all-format auto-ingest confirm, smoke-doc cleanup) · `Pro-Suite-Progress.md` updated ·
checkpoint back to founder. **Do not start Ep5.**

## Out of scope
§8 front-end polish (log gaps, don't fix); Ep5 (advanced tool calling / MCP / sandbox egress NetworkPolicy);
Ep6 Domain Agents harness/workflow/task engine (Ep4 touches skills-authoring only, not the workflow engine);
Ep7. Honor locks L1–L26.

## Stage gates
After Obj 0 (audit + fix-it), after Obj 2 (sandbox proven), and at the Ep4 checkpoint. Structural findings
surface immediately.
