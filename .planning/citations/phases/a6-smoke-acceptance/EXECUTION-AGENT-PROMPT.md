# Citations (Episode 7) — Sub-phase A6 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A6 Track 1 only** (acceptance harness +
> smoke + staging the live-DB runbook). **Do NOT apply anything to live Supabase** — that is a separate working
> session with London. Do **not** start Ep7B.

---

You are the **execution agent** for Sub-phase A6 (Ep7A Smoke + Acceptance) of the ArchitectOS Episode 7 build.
You build against **decided design** — implementation choices only. If something needs a design decision beyond
the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`.

**What A6 is, in one line:** prove Ep7A end-to-end across every **lit** source-kind in VCSO + the artifact
library, fold in the L18 credential debt, and **stage** (write + validate, do not apply) the consolidated
live-DB runbook. **You mutate nothing on the shared Supabase project.**

---

## CRITICAL BOUNDARY — read first

- **Track 1 (yours):** the acceptance harness + smoke, and writing/validating the live-DB **runbook**. Runs
  against local/test fixtures (or a Supabase **branch** DB if you truly need one — never the shared project).
- **Track 2 (NOT yours):** applying the migrations + confirming the platform tables on **live shared Supabase**.
  That is a working session between London and the strategy thread. **Do not call `apply_migration` /
  `execute_sql` writes against the shared project. Do not apply `docs/migrations/20260706_*.sql` live.** If a
  check requires the live schema, mark it **`pending-live`** — do not force it.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a6-smoke-acceptance/RESEARCH.md` — **primary source.** The acceptance matrix
   (§1), the live-apply runbook (§2 — gated, do not run), the L18 debt (§3), the apply posture (§4).
2. `.planning/citations/phases/a6-smoke-acceptance/A6-01-PLAN.md` — two-track task + criteria.
3. `.planning/citations/phases/a6-smoke-acceptance/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §2 (what's lit), §3.1 DP5, **§8 the
   live-DB ledger** + all phase amendments.
5. The built stack: `services/citations/*`, the VCSO citation UX (A3), artifact delivery (A5), and
   `docs/migrations/20260706_*.sql`.

Read 1–4 fully before writing a line.

---

## What you build (Track 1 only)

- **Acceptance harness** (`python-backend/tests/test_ep7a_acceptance.py` or a harness script) — the **family ×
  surface matrix** (RESEARCH §1): for each **lit** family (`document_chunk`, `wiki_page`, `platform_record`) in
  **VCSO** and the **artifact library**, exercise query/answer → chip → `POST /api/citations/resolve` →
  Check-Citations verdict. Mark `web` **pending-producer** and `reflection_reviews` **dormant** — do not fail
  them. Verifier checks: unsupported claim → `unsupported`, faithful quote → `supported`, unreadable →
  `unresolvable`.
- **L18 credential-debt smoke** — gather the Ep5/§8 outstanding live-credential items (sandbox verify, tool-loop
  credential checks); run what's runnable without shared-project mutation; mark the rest `pending-live`.
- **Live-DB runbook** — validate (do not apply) RESEARCH §2: confirm the two migration files are idempotent, the
  R2 dependency tables (`ai_models`, `platform_ai_settings`) are referenced correctly, and the verify queries are
  correct. Leave it as a ready-to-run runbook for the London session.
- **Progress** — update `Pro-Suite-Progress.md` with the Ep7A row + the `pending-live` list.

---

## Hard constraints

- **No live shared-Supabase mutation.** No `apply_migration`, no `execute_sql` writes against the shared project.
- **Mark, don't fail** dark/dormant families (`web`, `reflection_reviews`) and live-dependent checks (`pending-live`).
- **No new feature build**, no Ep7B geometry, no §8 visual polish, no backfill.
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (A6 Track 1 success criteria — CONTEXT §"Success criteria")

1. E2E matrix green for all **lit** families in both surfaces (local/test/branch); dark/dormant marked, not failing.
2. L18 items gathered + runnable parts exercised; the rest `pending-live`.
3. The live-DB runbook (RESEARCH §2) is complete + validated; **nothing applied live.**
4. `Pro-Suite-Progress.md` updated.

**Report back:**
- One paragraph on the matrix results (lit green; what's `pending-live`/dormant/pending-producer).
- The L18 items found + what ran vs pending-live.
- Confirmation the live-DB runbook is staged and **nothing was applied to shared Supabase.**
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call.

Then stop. The **Track 2 live-DB apply is a separate working session** between London and the strategy thread;
Ep7B is opened separately.
