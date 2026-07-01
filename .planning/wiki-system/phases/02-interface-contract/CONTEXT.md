# Sub-phase 02 Context — Interface Contract

**Date:** 2026-06-30
**Outcome:** Ready to execute. The reference extraction is **done** (`02-RESEARCH.md`) and the
01-verify-delta corrections are folded in. The execution agent builds against decided design — it
makes implementation choices only, not design choices.

---

## What this sub-phase is

Freezes the **wiki interface contract** — the seam this build owns and the later connection phase
consumes. This is the highest-leverage de-risking step: the wiki must not be built with a surface
the connection phase can't consume. Output is a versioned contract doc + the two capability rows +
stub handlers + the named orchestrator seams.

This sub-phase **is** a builder (unlike 01). It writes a small amount of code: capability registry
rows and `not_implemented` stub handlers in the existing orchestrator. It does **not** build storage,
real handler logic, or compilation.

---

## Inputs the agent must read first

1. `02-RESEARCH.md` (this folder) — the build-ready extraction: exact B1/B2/B6/A2 shapes, the read
   API, the §B seams, the hard guarantees, and the extract/skip rule. **Primary build source.**
2. `02-01-PLAN.md` (this folder) — the task spec + success criteria.
3. `../../CONTEXT.md` — locked decisions; §4 is the contract source, §4.4 the guarantees, §8 the
   01-delta amendments (orchestrator seams, `global_checkpoint` naming, 5-stage model).
4. `../01-verify-delta/01-01-DELTA.md` §A (GM query interface) and §B (orchestrator rework).
5. `../../REFERENCES.md` rows B1/B2/B6/A2 for the source URLs (context only — `02-RESEARCH.md`
   already extracted what's needed).

---

## Decisions already made (do not re-open)

- Claim/evidence shape, digest shape, the five narrow mutations, read API, and `global_ip_get` are
  fixed in `02-RESEARCH.md` §§1–5. Build them as written.
- Source-kind naming is `global_checkpoint` (not `gm_checkpoint`); add `wiki_evidence`, `wiki_digest`
  (CONTEXT §8).
- Orchestrator hosting requires the §6 in-place seams — name them in the contract; do not stand up a
  parallel orchestrator.
- Confidence is dual (display enum + hidden `recall_score`); never collapse.

---

## What this sub-phase does NOT do

- No storage / tables / migrations (sub-phase 03).
- No real handler logic, no compilation, no embeddings (04+).
- No write-surface implementation beyond declaring it in the contract (05 builds it).
- No UI. No chat/router wiring (connection phase).
- No substrate from the reference repos (no markdown vaults, JSON-file caches, CLIs).

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `02-01-CONTRACT.md` (this folder) | **Create** | Versioned `contract_version: wiki-1.0`. Every op: signature, args, return, errors, actor-scope, invariant. Includes §6 seams + §7 guarantees verbatim. |
| `python-backend/services/agent_capabilities.py` | **Modify** | Add `per_user_wiki` + `global_ip` to `_fallback_capabilities()` (+ DB rows in `agent_capabilities`). |
| `agent_capabilities` table (Supabase) | **Insert** | The two capability rows (service-role). |
| `python-backend/services/sub_agent_orchestrator.py` | **Modify** | Add `start_run()` stub branches returning `not_implemented` `agent_result_v1`. |

---

## Success criteria (from `02-01-PLAN.md`)

1. `02-01-CONTRACT.md` exists, versioned `wiki-1.0`, every op specified with actor-scope + invariant.
2. `per_user_wiki` + `global_ip` register and are listed by `list_capabilities()`.
3. Orchestrator dispatches both to stub handlers returning valid `agent_result_v1`.
4. Hard-guarantees section present and referenced by 03/04/05/07 as conformance clauses.
5. Write-surface actor-scope guards specified (who may call each mutation).
6. The §6 orchestrator seams are **named** in the contract (signatures/scope), so 03–05 build against them.

---

## Handoff

When `02-01-CONTRACT.md` is frozen and the rows/stubs register + dispatch, the contract is stable.
The strategy thread reads it, then opens **sub-phase 03 (schema-foundation)** with its own extraction
pass (deep: B1 fields, A1 schema-object, action-boundary metadata).

*Context written: 2026-06-30 — Discuss/Plan thread, post-01-delta reconciliation.*
