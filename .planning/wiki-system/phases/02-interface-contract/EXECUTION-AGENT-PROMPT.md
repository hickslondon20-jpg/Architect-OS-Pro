# Wiki System — Sub-phase 02 (Interface Contract) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Sub-phase 02 (Interface Contract) of the ArchitectOS Wiki System
build. You build against **decided design** — you make implementation choices (naming, file
placement, test specifics), never design choices. The reference extraction is already done; you do
**not** re-interpret the source repos. If something would require a design decision beyond what the
inputs specify, **stop and flag it** rather than improvising.

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/02-interface-contract/02-RESEARCH.md` — **your primary build
   source.** Exact claim/evidence shape (§1), digest shape (§2), the five mutations (§3), provenance
   rule (§4), read API + `global_ip` (§5), the orchestrator seams to name (§6), the hard guarantees
   (§7), and the extract/skip rule (§8).
2. `.planning/wiki-system/phases/02-interface-contract/02-01-PLAN.md` — task spec + success criteria.
3. `.planning/wiki-system/phases/02-interface-contract/CONTEXT.md` — this sub-phase's scope.
4. `.planning/wiki-system/CONTEXT.md` — locked decisions (§4 contract, §4.4 guarantees, §8 amendments).
5. `.planning/wiki-system/phases/01-verify-delta/01-01-DELTA.md` §A (GM query interface) and §B
   (orchestrator rework you must conform to).
6. `python-backend/services/agent_capabilities.py`, `sub_agent_orchestrator.py` — mirror the existing
   `document_analysis_agent` / `structured_data_agent` / `kb_explorer_agent` registration + dispatch
   pattern exactly.

## What you build

### 1. `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` (versioned `wiki-1.0`)
Authoritative contract. For **every** operation specify: signature, args (+ types), return shape,
error modes, **which actor class may call it** (compilation service / domain agent / founder /
orchestrator-read), and the invariant it upholds. Cover:
- **Read:** `wiki_get_page`, `wiki_get_claim`, `wiki_search`, `wiki_search_insight`,
  `wiki_read_digest`, `global_ip_get` (02-RESEARCH §5).
- **Digest:** the `digest{…}` object, field-by-field, with how each is computed (§2).
- **Write:** `propose_insight_claim`, `set_claim_confidence`, `flag_contradiction`, `add_override`,
  `promote_insight`, `demote_insight` (§3), each with actor-scope.
- **Data shapes:** `claim{…}` and `evidence{…}` exactly as §1 (single-sourced; compiler writes,
  agent reads). `source_kind ∈ {raw_document, document_chunk, tier0_record, global_checkpoint}`.
- **Orchestrator seams:** name the four §6 seams (dispatch branches/registry, `AgentContextBuilder`
  scope+loaders, `APPROVED_SURFACES` expansion or a deterministic GM/global-IP read service, new
  `allowed_source_kinds`) with their signatures, so 03–05 implement against them.
- **Hard guarantees:** transcribe 02-RESEARCH §7 verbatim as conformance clauses.

### 2. Capability registry rows
Add `per_user_wiki` and `global_ip` to `agent_capabilities` — both as DB rows (service-role insert)
and in `_fallback_capabilities()` so the system degrades gracefully. Use exactly:
- `per_user_wiki` — tools `wiki_get_page, wiki_get_claim, wiki_search, wiki_search_insight,
  wiki_read_digest`; source kinds `wiki_page, wiki_claim, wiki_evidence, wiki_digest`; surfaces
  `virtual_cso, os_engine, domain_agent, sprint_planning`; `output_schema {version: agent_result_v1}`.
- `global_ip` — tools `global_ip_get`; source kinds `global_ip_page, global_checkpoint`; surfaces
  `virtual_cso, domain_agent, system`; `output_schema {version: agent_result_v1}`.

### 3. Handler stubs
In `sub_agent_orchestrator.py`, add `start_run()` dispatch for both capabilities returning a
structured `not_implemented` `agent_result_v1` result. This proves registration + dispatch
end-to-end before storage exists. Do **not** implement real retrieval here.

## Hard constraints

- **No storage, no migrations, no real handler logic, no compilation, no UI.** Stubs + contract only.
- **No substrate** from the reference repos — no markdown vault layout, no `agent-digest.json`/
  `claims.jsonl` files, no CLI, no `wiki_apply` single-verb. If you start specifying a file path or
  vault layout in the contract, you've crossed into substrate (02-RESEARCH §8) — stop.
- **Don't rename tools.** The connection phase binds to these exact names.
- **Conform to the existing orchestrator pattern** — `agent_result_v1`, first-class citations via
  `AgentSourceRef`, registry-row shape from `_fallback_capabilities()`.
- Confidence is **dual** — display enum `high|medium|low` + hidden `recall_score`. Never collapse.

## Done when

All six success criteria in `02-01-PLAN.md` are met: the contract is versioned and complete with
actor-scope + guarantees + named seams; both capabilities register and list; the orchestrator
dispatches both to valid `not_implemented` stubs. Verify Python compiles (`python -m compileall
python-backend`). Report back: a one-paragraph summary, the contract version, and confirmation that
the §6 seams are named so 03 can build the schema against a stable surface. Then stop — sub-phase 03
is opened from the strategy thread.
