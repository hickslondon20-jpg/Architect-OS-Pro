# ArchitectOS Pro Releases

This file tracks numbered release pushes. Episode-focused releases use the same numbering system as
larger combined feature areas, so the release trail stays continuous after the reference-repo episodes
are complete.

## v0.4 — Agent Skills & Sandbox Buildout

**Release focus:** Episode 4, Agent Skills & Document Generation Engine.

This release closes the full skills-and-sandbox arc: founder-visible skill management, persistent tool
memory, private/global skill routing, Python-backed guided skill drafting, GKE-backed sandbox execution,
artifact delivery, and Virtual CSO integration for sandbox-enabled skills.

### New Capabilities

- **Skills foundation:** `skill_packs` and `skill_files` support global and private skill packs, scoped
  ownership, ZIP import/export, and attached script/reference/asset files.
- **Skills library UI:** founders can browse skills, search the chat rail skill library, and insert
  `@slug` invocations into the active Virtual CSO composer without clobbering draft text.
- **Guided skill drafting:** the backend can run an AI-guided skill creation flow through the Python
  service instead of a frontend webhook dependency.
- **Persistent tool memory:** sub-agent runs can link back to assistant messages so tool steps reload
  with chat history and prior tool results can be reused in follow-up turns.
- **Sandbox infrastructure:** a GKE-backed Python sandbox image supports stateful per-thread execution
  with the required document/spreadsheet/chart libraries.
- **Artifact delivery:** sandbox-generated files can be delivered through Supabase Storage, with
  renderable artifacts opening in the Reader and downloadable artifacts using signed URLs.
- **Virtual CSO sandbox integration:** `requires_sandbox` skills trigger the new
  `sandbox_execution_agent`, which runs an internal bounded tool-use loop with `execute_code` and
  `read_skill_file`, then threads results and produced artifacts back into the chat turn.

### Release Notes

- The outer Virtual CSO streaming call keeps its existing no-tool-calling shape; sandbox tools live only
  inside the backend sub-agent loop.
- Produced files use the deterministic `PRODUCED_FILE: /sandbox/path/to/file.ext` convention for artifact
  handoff.
- The sandbox execution capability is scoped to `virtual_cso` only, with recursive agent spawning
  disabled.
- The next numbered release should continue with `v0.5`.

## v0.5 — Advanced Tool Calling, Citations, Gate 1 Verification & Tier-1 Wiki Synthesis

**Release focus:** Episode 5 (Advanced Tool Calling), Episode 7 (Citations & Source Grounding),
Ep1 Gate 1 live verification, and the Tier-1 Wiki Synthesis Upgrade (MA-03).

Compiled from `Pro-Suite-Progress.md`'s change log for everything landed since v0.4. The Ep5/Ep7/
Gate 1 entries below are summarized from that tracker; the MA-03 entry is this session's own build
and independently live-verified end to end.

### New Capabilities

- **Episode 5 — Advanced Tool Calling:** dynamic tool registry, sandbox bridge, and MCP
  integration completed across all 7 planned phases (2026-07-03).
- **Episode 7 — Citations & Source Grounding:** `vcso_chat_messages.citations`, the
  `citation_verifier`, and `document_chunks` geometry columns live-applied and verified; local
  acceptance harness added for citation families across Virtual CSO and the artifact library
  (2026-07-06).
- **Ep1 Gate 1 verification & wiring (MA-01):** fixed the `.env`/`.env.local` naming trap, wired
  LangSmith (`wrap_anthropic`/`wrap_openai`) across every Anthropic/OpenAI client construction site,
  and proved the full Ep1 ingestion pipeline live end-to-end for the first time with zero mocks -
  upload → registry → parse → metadata extraction → chunk → embed → automatic Claude doc-wiki
  synthesis → hybrid/RRF retrieval. Module-level smoke (M3/M5/M7/M8) also verified live
  (2026-07-07/08).
- **Tier-1 Wiki Synthesis Upgrade + auto-trigger (MA-03):** the 7 Tier-1 wiki pages
  (`business_context`, `diagnostic_synthesis`, `current_quarter_sprint`, `growth_constraints`,
  `financial_context`, `client_market_position`, `open_questions`) moved from mechanical
  `.limit(3)` templating to real Sonnet synthesis, with claim-evidence grounding (a claim is
  dropped rather than kept unsourced), an explicit "we don't know this yet" thin-page policy, and
  an observable `mechanical_fallback` sentinel when synthesis isn't used. Fixed a systemic
  two-hop-owner-column gap across every `ae_*`/`gm_*` assessment child table (none of them carry
  their own `user_id`), fixed `_project_to_ose`'s silent CHECK-constraint violations and missing
  embeddings, and fixed a table/FK primary-key collision in citation resolution
  (`gm_capability_rankings` carries both its own PK and a sibling FK that could be mistaken for
  it). All 7 pages are now live-verified for the test user: `synthesis_used=true`, zero
  `wiki_validation_findings()` rows platform-wide, correct `ose_knowledge_pages` projection and
  embeddings, and manual claim-by-claim narrative grounding review.
- **Wiki auto-trigger wiring (MA-03 Objective 4):** the 10 `event_rebuild_targets` events are now
  emitted live via Supabase `pg_net` DB triggers on the 12 underlying platform tables (chosen over
  scattered frontend call-sites since the actual writes are fragmented across the React data layer
  and backend-only paths for AE Ladder/GM Audit results) - async and non-blocking by construction,
  proven live end-to-end via a real trigger-fired `pg_net` call. `open_questions` auto-chains after
  any of the other 6 pages compiles. A 10-minute recency-guard debounce in `compile_page` bounds
  recompute/synthesis cost against rapid repeated writes, with a `force` override for manual
  recompiles.

### Release Notes

- MA-03's live end-to-end trigger test surfaced that the `api.architectospro.com` deployment needs
  to be current with this release before the auto-trigger path will actually complete a compile
  (an HTTP 500 was returned mid-verification, consistent with a stale deploy) - retest after this
  release goes live.
- A secret-handling gap was found and logged (not fixed by rotation yet, folded into the founder's
  planned pre-launch key rotation): see `.planning/codebase/Concerns.md`, "Secrets and Credential
  Risk" section.
- The next numbered release should continue with `v0.6`.
