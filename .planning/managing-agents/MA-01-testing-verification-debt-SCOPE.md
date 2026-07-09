# Managing-Agent Scope — MA-01: Episode-by-Episode Live-Verification Pass

> Episode-structured verification pass (v2). This managing agent spins up **per-episode execution
> agents**; the orchestration agent + founder hold cross-workstream context and the router decision.
> Honors locks L1–L26.

---

## Mission

Move the intelligence layer from **backend-complete → live-verified** for the first time, by walking
each episode and checking that **everything it said it would enable is actually wired and functioning
end to end** — traced through the real product seams (upload → ingestion → wiki page → retrievable →
citable), not an abstract checklist. This is **discovery, not confirmation**: the wiki has zero pages
today and the ingestion→compile pipeline has never run live. **Ep1 is Gate 1** — the sequence
front-loads the highest-discovery-risk work by construction.

## Prerequisites
- **OpenAI billing/quota cleared** (unblocks ingestion embeddings + Ep7 verifier).
- **LangSmith added** as the observability spine (resolves the tracker's TBD observability decision).
  Confirm it captures the Python backend's Anthropic **and** OpenAI calls with no secrets/PII.
- Live for execution agents: Anthropic key, GKE/sandbox creds + `ARCHITECTOS_PYTHON_BACKEND_URL` /
  `ARCHITECTOS_INGEST_SECRET`, Supabase service-role for `pwacpjqkntnovndhspxt`.

## Method (applies to every episode)
1. **Derive the checklist from the docs first** — the episode map's "what this enables" + the plan
   files (`docs/plans/` for Ep1 modules; `.planning/<workstream>/` for Ep2/4/5/6/7).
2. **Score each enablement on two rungs, separately:** *backend-live-verified* (works when exercised
   directly via API/script/LangSmith trace) vs. *usable* (works through the real front-end). A backend
   capability hitting a mock/unwired UI is a **§8 gap, logged as such — NOT an episode failure.**
3. **Fix policy:** **fix-in-place** contained wiring bugs; **discover-and-report** anything structural
   — surface it before touching a seam.
4. **LangSmith is the spine** — capture the trace for each flow as evidence of what fired.
5. **Test the canonical Python path**, never the legacy Vercel `api/vcso/chat.ts` (rollback only).
6. **Bound and timebox** to the earmarked enablements. No §8 work, no UI polish, no new features.
7. **Dependency blocking is expected** — if Ep1 uncovers deep breakage, downstream episodes may be
   partly blocked. That's discovery; report and re-plan rather than forcing green.

**Output: a per-episode Enablement Matrix** — each capability × {backend-live-verified / usable /
broken / §8-gap} + LangSmith trace ref + fix/finding note. Updates `Pro-Suite-Progress.md`.

## Episode sequence (dependency order)
- **Ep1 — RAG Foundation = GATE 1 (highest discovery risk).** Docs `docs/plans/plan-ep1-*`. Trace
  upload → raw storage + registry → Docling parse → metadata extraction → chunk → embed →
  `document_chunks` → wiki page(s) created. Plus dedup (M3), hybrid/RRF (M6), structured-data (M7),
  sub-agent scaffold (M8). Checkpoint back before proceeding.
- **Ep2 — KB Explorer + retrieval.** Docs `.planning/knowledge-base-explorer/`. KB nav tools; wiki
  tools; retrieval router + chat. Connection-A "CSO uses the wiki" folds here + the `experimental`
  capability-status check.
- **Ep4 — Skills & Sandbox / Artifacts.** Skill CRUD/import-export, guided creator, sandbox execution,
  artifact render + delivery, `requires_sandbox` triggering from VCSO.
- **Ep5 — Advanced Tool Calling.** Registry + `tool_search`; VCSO tool loop; sandbox bridge; tagged
  usage stream; degradation %/compaction; interleaved history. Sandbox deny-all egress NetworkPolicy.
- **Ep6 — Agent Harness / Domain Agents.** Monthly P&L workflow end to end; Deep Mode; `@Agent`.
  Connection-A "Domain Agents consult the wiki" folds here (the one small build).
- **Ep7 — Citations.** Currency + resolvers + chips/sidecar/Check-Citations + artifact citations. MRA
  fix folds here (repoint `mra_checkpoints`→`gm_checkpoints`/`gm_*` + resolver-integrity guard +
  CLAUDE.md Rule #3 fix). Log `web` dark, PDF pixel-highlight (Ep7B) as remaining.
- **→ Cross-tier evidence point (report, do not decide):** assess un-routed cross-tier answer quality
  → recommend router in first beta vs. fast-follow.

## Checkpoints
After **Ep1 / Gate 1** and at the **cross-tier evidence point**. Structural findings surface immediately.

## Locks & out of scope
Honor L18 (this pass is the debt payoff), L10 (forward-only), L22/L11 (citation currency + curated
trace), L20 + CLAUDE.md Rule #4, three-lane synthesis, Claude-locked. §8 front-end, router build (C),
and post-MVP/v1 items are out of scope; the Ep6 wiki-read wiring is the only build.
