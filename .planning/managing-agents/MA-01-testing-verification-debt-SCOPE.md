# Managing-Agent Scope — MA-01: Episode-by-Episode Live-Verification Pass

> Draft for founder review (v2 — episode-structured). **Not yet spun up.** Revised 2026-07-06.
> Supersedes the objective-ordered v1. Aligns to `STATE-AND-ROADMAP-TO-MVP.md` (steps 1–2) and
> honors locks L1–L26. This managing agent spins up **per-episode execution agents**; the
> orchestration agent + founder hold cross-workstream context and the router decision.

---

## Mission

Move the intelligence layer from **backend-complete → live-verified** for the first time, by
walking each episode and checking that **everything it said it would enable is actually wired
and functioning end to end** — traced through the real product seams (upload → ingestion →
wiki page → retrievable → citable), not an abstract checklist. This is **discovery, not
confirmation**: the wiki has zero pages today and the pipeline has never run live. **Ep1 is
Gate 1** — the sequence front-loads the highest-discovery-risk work by construction.

---

## Prerequisites

- **OpenAI billing/quota — CLEARED (2026-07-06, founder).** Ingestion embeddings + Ep7
  verifier are unblocked. Gate 1 can run.
- **LangSmith — ADDED (2026-07-06, founder)** as the observability spine (resolves the
  tracker's TBD observability decision — log it in the decisions log). Every traced flow gets a
  call-tree, so "what fired" is evidence. *Confirm as Ep1's first action:* LangSmith is
  capturing the Python backend's Anthropic **and** OpenAI calls, and is **not** logging secrets
  or founder PII into traces.
- **Anthropic + Supabase service-role — in `.env`** (founder-confirmed).
- **GKE sandbox — needs a credential (not keyless).** `sandbox_service.py` requires
  `ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY` = the service-account **JSON key** (raw JSON or file
  path); no ADC/workload-identity fallback exists in code. Also set `ARCHITECTOS_GCP_PROJECT_ID`,
  `ARCHITECTOS_GCP_REGION`, `ARCHITECTOS_GKE_CLUSTER_NAME`, `ARCHITECTOS_SANDBOX_IMAGE`.
  **Only needed from Ep4 onward** (sandbox/bridge) — **Ep1–Ep2 are not blocked by it**, so it
  can be added before Ep4.
- **Ingest secret — self-chosen shared secret.** Set `ARCHITECTOS_INGEST_SECRET` on the backend
  and pass the matching `x-ingest-secret` header from smoke callers; set
  `ARCHITECTOS_PYTHON_BACKEND_URL` on the caller side. If unset, the guard silently disables
  (endpoints open) — acceptable for isolated local smoke, but set it for real e2e verification.

---

## Method (applies to every episode)

1. **Derive the checklist from the docs first.** Before testing an episode, extract its
   earmarked enablements from its own documentation — the episode map's "what this enables"
   plus the plan files (`docs/plans/` for Ep1 modules; `.planning/<workstream>/` phase plans
   for Ep2/4/5/6/7). Every check traces to something we actually specified — nothing invented,
   nothing open-ended.
2. **Score each enablement on two rungs, separately:**
   - **backend-live-verified** — capability works when exercised directly (API/script/LangSmith
     trace).
   - **usable** — works through the real front-end with real data.
   A capability that works on the backend but hits a mock/unwired UI is a **§8 gap, logged as
   such — NOT an episode failure.** Do not conflate the rungs.
3. **Fix policy (founder-set):** **fix-in-place** contained wiring bugs (e.g. the MRA repoint);
   **discover-and-report** anything structural — no execution agent silently redesigns a seam.
   Structural findings come back to orchestration + founder before any fix.
4. **LangSmith is the spine** — capture the trace for each flow as the evidence of what fired.
5. **Test the canonical Python path**, never the legacy Vercel `api/vcso/chat.ts` (rollback
   only). Testing the wrong path gives false results.
6. **Bound and timebox per episode** to the earmarked enablements; report and move on. No §8
   front-end work, no UI polish, no new features mid-pass.
7. **Dependency blocking is expected** — if Ep1 uncovers deep breakage, downstream episodes may
   be partly blocked. That's discovery working; report and re-plan rather than forcing green.

**Output: a per-episode Enablement Matrix** — each earmarked capability ×
{backend-live-verified / usable / broken / §8-gap} + LangSmith trace ref + fix/finding note.
This becomes the live-verified map and updates `Pro-Suite-Progress.md` (readiness-ladder
language).

---

## Episode sequence (dependency order)

**Ep1 — RAG Foundation = GATE 1 (highest discovery risk).**
Docs: `docs/plans/plan-ep1-*` (ingestion, M2 vector, M3 record manager, M4 metadata, M5
Docling, M6 hybrid/rerank, M7 structured data, M8 sub-agent). Trace the core flow live: upload
→ raw storage + registry row → Docling parse → metadata extraction → chunk → embed →
`document_chunks` → **wiki page(s) created** (doc-wiki Tier-2 synthesis on ingest **and** Tier-1
compile→`_project_to_ose` mirror). Plus: dedup (M3), hybrid/RRF retrieval (+Cohere if keyed,
M6), structured-data tools (M7), sub-agent scaffold (M8). **This is where "the brain turns on"
is proven or broken.** Checkpoint back to orchestration with Gate 1 findings before proceeding.

**Ep2 — KB Explorer + retrieval.**
Docs: `.planning/knowledge-base-explorer/`. KB nav tools (kb_ls/tree/grep/glob/read); wiki
tools (Phase 8); retrieval router + chat experience (Phase 9). **Connection-A "CSO uses the
wiki" folds here:** upload → page → ask → CSO retrieves + cites the wiki page in a normal turn;
agentSteps surface. Includes the `experimental` capability-status check (does `list_active()`
surface the wiki capabilities to the gated path).

**Ep4 — Skills & Sandbox / Artifacts.**
Docs: `.planning/skills-sandbox/`. Skill CRUD/import-export, guided creator (direct-Anthropic
lane), building-block files, shared sandbox execution, artifact render + delivery, and
`requires_sandbox` skills triggering from VCSO. Trace: invoke a skill → sandbox runs → artifact
produced → links to chat message → appears in reader/library.

**Ep5 — Advanced Tool Calling.**
Docs: `.planning/tool-calling/`. Unified registry + `tool_search`; VCSO in-thread tool loop;
**exec-channel sandbox bridge** (code calls platform tools, creds host-side); tagged usage
stream; degradation %/compaction; interleaved history survives reload. **Sandbox deny-all
egress NetworkPolicy verification lives here.**

**Ep6 — Agent Harness / Domain Agents.**
Docs: `.planning/agent-harness/`. Trace the Monthly P&L workflow end to end: launch → task →
Blocked-on-upload → upload → resume → Analyze/Synthesize → `artifact.html` → Review → Download /
Add-to-Second-Brain (**promotion → OS Engine ingestion feeder**). Plus Deep Mode (VCSO
autonomous: plan panel, workspace, ask_user, todos) and `@Agent` invocation (spawns a task in
the same plumbing). **Connection-A "Domain Agents consult the wiki" folds here** (add wiki-read
to the P&L context/prereq step + verify) — this is the pass's one small build.

**Ep7 — Citations & Source Grounding.**
Docs: `.planning/citations/`. Unified citation currency; resolver families; VCSO
chips/sidecar/jump-to-evidence/Check-Citations; Domain-Agent artifact citations. **MRA fix
folds here** (founder decision: sequenced within Ep7, not pulled forward as a quick win) —
Tier-0 record resolver repoint `mra_checkpoints`→`gm_checkpoints`/`gm_*` + resolver-integrity
guard + CLAUDE.md Rule #3 fix; the contained fix-in-place item. Log `web` citations dark (no
producer) and PDF pixel-highlight (Ep7B) as remaining if Docling/real-PDF unavailable.

**→ Cross-tier evidence point (report, do not decide).** Emerging from the Ep2/Ep6/Ep7
cross-tier checks: assess how good the **un-routed** cross-tier answers actually are, and bring
a **router in-first-beta vs. fast-follow** recommendation back to orchestration + founder.
MA-01 does not make this call.

---

## Checkpoints back to orchestration

After **Ep1 / Gate 1** (discovery findings — go/no-go on proceeding) and at the **cross-tier
evidence point** (router recommendation). Structural findings surface immediately, not batched.

## Locks & boundaries

L18 (this pass is the debt payoff), L10 (no backfill — forward-only), L22/L11 (citation
currency + curated-trace/no-raw-CoT — keep the answer/citation/trace contract stable), L20 +
CLAUDE.md Rule #4 (artifact export vs. fixed-report N8N scope), three-lane synthesis rule,
Claude-locked orchestration. Do not override a lock without founder sign-off; flag conflicts.

## Out of scope

UI polish (roadmap step 3), §8 real-wiring/design, the router build (C), and all post-MVP/v1
items. The Ep6 wiki-read wiring is the **only** build; everything else is verify + fix-in-place
of contained wiring bugs.

## Deliverables

Per-episode Enablement Matrix · Gate 1 findings + fixes report · MRA fix + guard merged, Rule
#3 updated · LangSmith decision logged + capture/no-leak confirmed · updated
`Pro-Suite-Progress.md` · router-timing recommendation.

## Success / exit

Each episode's earmarked enablements are backend-live-verified or explicitly logged (broken →
reported, or §8-gap); the P&L workflow runs end to end; VCSO retrieves + cites the wiki; a
Domain Agent consults it; and the founder has an evidence-based router-timing recommendation.
The layer is **live-verified** — not yet usable (that's §8).

---

## Resolved with founder (2026-07-06)

1. **Credentials:** Anthropic + Supabase in `.env`. GKE requires a service-account **JSON key**
   (`ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY`) + GCP targeting vars — **not keyless** — but only
   from **Ep4** onward, so Ep1–Ep2 start unblocked; founder to add the GKE key before Ep4.
   Ingest secret is a self-chosen shared secret (set on backend + caller) for real e2e smokes.
2. **Execution mode: strictly serial.** One episode at a time; stop, fix/refine, then proceed.
   No parallel episode agents.
3. **MRA fix: sequenced within Ep7**, not pulled forward — work in build/episode order.
