# Wiki System — Build Roadmap (Compiled Wiki / Tier 1)

**Feature:** ArchitectOS Wiki System — Tier 1 compiled business-knowledge layer
**Roadmap position:** Phase 8 of the intelligence-layer roadmap (KB Explorer build complete).
This feature is itself a multi-sub-phase build, tracked here (mirrors how the KB Explorer build
is tracked in `.planning/knowledge-base-explorer/`).
**Decisions:** see `CONTEXT.md` (locked) — read it first
**Spec:** `ArchitectOS-Wiki-System-Spec-v1.md` (co-located in this folder)

---

## Process rules

- **One sub-phase at a time.** Each sub-phase completes and is verified before the next begins.
- **Per-sub-phase CONTEXT + EXECUTION-AGENT-PROMPT are authored when we reach that sub-phase** —
  not up front. We discuss/refine the sub-phase's plan, then generate its `CONTEXT.md` and
  `EXECUTION-AGENT-PROMPT.md`, then spin the execution agent.
- **Verify before build.** Sub-phase 01 produces a delta against CONTEXT before any schema lands.
- **Contract before internals.** Sub-phase 02 freezes the interface contract before storage/compilation detail.
- **Execution agents are separate threads**, each pointed at its sub-phase folder.
- **Single-writer guarantee is sacred** (CONTEXT L2): nothing but the compilation service writes the compiled base.
- **No chat wiring.** The connection layer (router, stage-primer assembly, CSO/OS-Engine/Domain-Agent integration) is the later connection phase, out of scope here.

---

## Sub-phase sequence

Each sub-phase is its own self-contained folder under `phases/`. Plans listed are the
directional plan files already written; `CONTEXT.md` + `EXECUTION-AGENT-PROMPT.md` are added
per sub-phase as we reach it.

| Sub-phase | Folder | Plan(s) | Depends on | Owns |
|---|---|---|---|---|
| 01 | `01-verify-delta` | 01-01 | — | No-code inventory; delta doc vs CONTEXT §5 |
| 02 | `02-interface-contract` | 02-01 | 01 | Freeze read/digest/write surfaces; register `per_user_wiki` + `global_ip` |
| 03 | `03-schema-foundation` | 03-01 (schema), 03-02 (config object) | 01, 02 | Tables + RLS + embeddings + action-log + digest store; versioned schema object |
| 04 | `04-compilation` | 04-01 | 03 | `compile_page` per type, event→rebuild map, eager rebuild, embedding refresh (binds D15 host) |
| 05 | `05-write-back` | 05-01 | 03, 02 | Narrow mutations, D11 gates, session-end flush, action-log writes |
| 06 | `06-validation-health` | 06-01 | 03, 04 | A7 checks + B8 surfaces feeding Open Questions |
| 07 | `07-consolidation` | 07-01 | 05, 06 | Dreaming cycle (internal): dedup, reconcile, contradiction-flag, retire, surface gaps |
| 08 | `08-acceptance` | 08-01 | 01–07 | End-to-end isolation test: event→compile→query→digest→health→consolidation |

### Dependency graph

```
01 ─┬─> 02 ─┬─> 03 ─┬─> 04 ─┬─> 06 ─┐
    │       │       │       │       ├─> 07 ─> 08
    │       └─> 05 ─┴───────┴───────┘
    └────────────────────────────────────> (delta informs all)
```

---

## Acceptance (build done-definition)

> **STATUS: PASSED — BUILD COMPLETE IN ISOLATION (2026-06-30).** Contract `wiki-1.0` stable; 43 passed /
> 2 intentional skips / 0 failed; all 5 hard guarantees live. Single open item: DI-EMBED (OpenAI quota →
> semantic-ranking quality unverified). See `phases/08-acceptance/08-01-ACCEPTANCE.md` and `CONTEXT.md §8`.

The wiki works in isolation, with **no** chat/router wiring:

1. Firing a source-change event (e.g. a diagnostic run) compiles the corresponding
   page's compiled base with claims, each carrying line-level evidence.
2. `wiki_get_page` / `wiki_search` return the compiled page; precedence is applied;
   class/trust is visible on every claim.
3. `wiki_read_digest` returns a current digest reflecting the compile.
4. A health report runs and surfaces contradictions / low-confidence / stale / orphans;
   gaps land on the Open Questions page.
5. `propose_insight_claim` lands a quarantined insight; it is reasoning-only and never
   asserted; `promote_insight` (founder-confirmation) is the only path to trusted, and is
   reversible via the action-log.
6. The consolidation cycle runs internally, tends the insight layer + Open Questions only,
   and never writes the compiled base or auto-promotes.

---

## Handoff to the connection phase (NOT this build)

Once sub-phase 02's contract is stable and sub-phase 08 passes, the KB Explorer planner picks
up the connection phase: retrieval router / intent classifier, cross-tier parallel assembly,
stage-primer injection, and wiring `per_user_wiki` / `global_ip` into the Virtual CSO streaming
endpoint, OS Engine, and Domain Agents. The CSO persona/voice layer (CONTEXT §7) is decided there.

**Connection-phase UI dependencies logged from 01-01-DELTA (out of scope for this build):**
- **§D RISK** — `SourcesPanel` renders a simplified `SourceRef{kind,label,pageId?}`; showing the
  rich `evidence[]` (`path/lines/weight/note`, claim-level) needs an evidence adapter + small
  display extension.
- **§C** — the OS Engine surfaces (`WikiView`/`IndexView`/`Reader`, `ose_knowledge_pages`,
  `ose_page_corrections`/`NotesComposer`) are the render-adapter target for compiled/insight/
  override claims and the digest; the wiki build produces the data, the connection phase renders it.
