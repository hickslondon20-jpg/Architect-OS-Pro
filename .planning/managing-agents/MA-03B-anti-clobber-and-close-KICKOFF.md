# Thread-Initiating Prompt — MA-03B: Anti-Clobber Guard + Real-Synthesis Close

> Paste to spin up a **brand-new agent** (not the one that did the earlier MA-03 build). Self-
> contained — assume no prior session context. Finalizes MA-03 (Tier-1 wiki synthesis).

---

You are a fresh agent finalizing **MA-03 (Tier-1 Wiki Synthesis)** for ArchitectOS Pro. The build
and auto-trigger wiring are done; your job is a small durable safety fix plus closing the
real-synthesis punch-list. You did **not** do the earlier work — read the state below, don't
assume anything from a prior session.

## Read first
1. `.planning/managing-agents/MA-03-CLOSEOUT-HANDOFF.md` — what was built, the bugs fixed, the incident.
2. `.planning/managing-agents/MA-03-tier1-synthesis-build-SCOPE.md` — the original build scope/design.
3. `.planning/managing-agents/MA-01-testing-verification-debt-SCOPE.md` — shared method (brains/engine split, locks).
4. `Pro-Suite-Progress.md`, `CLAUDE.md`, `.planning/codebase/CONCERNS.md`.
5. Code you'll modify: `python-backend/services/wiki_compilation.py` (compiler), `python-backend/main.py` (endpoints), `python-backend/scripts/ma03_tier1_synthesis_smoke.py` (founder-runnable smoke).

## Current verified state (confirmed via Supabase, 2026-07-08)
For test user **`cd490873-99aa-4533-9240-f0aa04deb54f`**, all 7 Tier-1 pages exist and project into `ose_knowledge_pages`:
- **4 real-synthesis pages** (`synthesis_model = claude-sonnet-4-6`, non-null embeddings, 1.6k–2.9k-char narratives): `diagnostic_synthesis`, `current_quarter_sprint`, `financial_context`, `client_market_position`.
- **3 degraded `mechanical_fallback` stubs** (null embedding, ~90-char narratives), clobbered at 21:33 UTC when the production trigger fired with dead keys: `business_context`, `growth_constraints`, `open_questions`.
- The founder has **rotated the OpenAI + Anthropic keys** in `.env` and Railway (2026-07-08).

## Hard rules (from the incident — non-negotiable)
- **Commit to git after every milestone**, not just at the end. Uncommitted work has been lost across session boundaries on this repo before.
- **Do not trust bash on this repo** (`.../ArchitectOS Pro_beta`) — it has shown stale/truncated content. Use Read/Grep/Glob; when in doubt, have the founder verify on their machine.
- **Never read or echo the `.env` / API keys.** Verify the key rotation **by outcome only** (DB `synthesis_model`, embeddings, LangSmith traces) — never by inspecting secret values.
- **Brains/engine split:** you have no internet in your sandbox — never boot the backend. The founder runs the backend/compiles/smoke on their machine; you write code + scripts, read the DB via **Supabase MCP**, and interpret the logs the founder pastes back.

## Tasks (in order — stop at the checkpoints)

**1. Confirm Railway picked up the new keys.** Ask the founder to confirm a **fresh Railway deploy/restart happened after the variable change** — Railway env edits don't take effect on the running service until a redeploy. (This is the likely cause of "correct value, still 401.")

**2. Prove the keys authenticate — by outcome, before any other work.** Have the founder run the smoke on one page (e.g. `diagnostic_synthesis`). Verify via Supabase MCP that the fresh compile wrote `synthesis_model = claude-sonnet-4-6`, `embedding IS NOT NULL`, and a new `last_compiled_at`, and confirm a fresh trace in LangSmith project `ArchitectOS-pro`. Also report whether LangSmith wrapping currently exists on the synthesis path (relevant to a later MA-01 rebuild). **Do not proceed until this is green** — the last "rotated" keys still 401'd. **→ Checkpoint: report the outcome to the founder.**

**3. Keep the production auto-trigger PAUSED** until the guard is in and keys are confirmed, so nothing re-clobbers the pages. Confirm the current trigger state and report it.

**4. Build the anti-clobber guard** in the compile path. Spec — handle all three cases:
- Synthesis failure **and a prior real-synthesis page exists** → **keep the good page, mark it `stale`, log it — do not overwrite** with the fallback.
- Synthesis failure **and no prior real page exists** (first-time compile) → write the fallback so the page isn't empty.
- Make the "kept-stale-instead-of-refreshed" outcome **observable** (a flag/log, same spirit as `synthesis_model = mechanical_fallback`) so a silently-stale page is visible in verification.
**→ Checkpoint: founder reviews the guard before recompile/re-enable.**

**5. Recompile all 7 for the test user** (keys now working, guard in place). Verify via Supabase MCP that **all 7** show a real Claude model + non-null embedding — especially the 3 previously-stubbed pages (`business_context`, `growth_constraints`, `open_questions`).

**6. Re-enable the production auto-trigger, run one live trigger test,** and confirm the triggered recompile lands **real** synthesis (not fallback). **→ This closes the MA-03 punch-list.**

**7. Commit after each milestone**; update `Pro-Suite-Progress.md` to reflect MA-03 fully closed (build + real-synthesis verified).

## Out of scope
MA-01 Gate 1 LangSmith rebuild (separate, next initiative), MA-02 (Ep2 verification), the other
secret rotations (Supabase/N8N/ingest/Vault — batched pre-launch by founder decision), front-end
wiring (§8), and the core-platform `check_gvs_save_limit` bug (logged in CONCERNS). Do not touch the
document-wiki writer.

## Locks
Honor L1–L26 — OS-Engine sole writer, `wiki-1.0` claims-with-evidence + Ep7 citation resolution
(L22/L11), three-lane synthesis, Claude-locked orchestration. Additive, forward-only migrations are
permitted (via Supabase MCP, no backfill — L10). Flag conflicts; don't override.
