# A5 RESEARCH — Artifact render surface + provenance-plumbing gap (extraction)

**Extraction target:** the artifact delivery path + the artifact-library render surface. A5 plumbs
`provenance.source_refs` through delivery, then renders it as citations reusing A2/A3. **Re-verify anchors
before editing — they drift.** Verified 2026-07-06.

---

## §1 The gap — provenance is persisted but not delivered

`python-backend/services/artifact_service.py`:
- Provenance is **written to the artifact row**: `_domain_artifact_provenance` (`:331–363`) builds
  `{schema_version: "domain_agent_artifact_provenance_v1", …, source_refs: [...]}` and it's stored (`:90,106`).
- But **`ArtifactDeliveryResult` (`:31–43`) has no `provenance` field** — fields are `id, user_id, source_kind,
  source_id, filename, mime_type, size, storage_path, renderable, description, content, signed_url`.
- `get_delivery(artifact_id, user_id)` (`:218–229`) returns `ArtifactDeliveryResult` → so provenance is dropped
  before it reaches the API.

**A5 backend task:** add `provenance` (or just `provenance.source_refs`) to `ArtifactDeliveryResult` +
`get_delivery` (read the row's `provenance`) + the `/api/artifacts/{id}` response model (`ArtifactDeliveryResponse`
in `main.py`, already `get_current_user_id`). Normalize `source_refs` → `CitationRef` via A0 `from_provenance_ref`.

## §2 Provenance source_refs origin (already CitationRef-adjacent)

`_domain_artifact_provenance` aggregates `tasks.step_results[n].source_refs` (`:337–351`). Upstream,
`harness_engine.py:413` sets `source_refs = result.citations` (sub-agent orchestrator citations, i.e.
`AgentSourceRef`-derived dicts). So the stored refs are **CitationRef-adjacent dicts** — `from_provenance_ref`
(A0) normalizes them; legacy rows predating A0 are handled by the same read-time normalize.

## §3 The render surface (O4)

`pages/ProSuite/domain-agents/DomainAgentArtifacts.tsx` — the artifact library. Preview panel ~`:177–195`
renders `previewContent` via `ReactMarkdown` (or raw HTML if it starts with `<`), fetched by
`getArtifact(previewArtifact.id)` (`:58,85`) → `ArtifactDelivery`. Page copy (`:112`) already promises "Preview,
download, **trace provenance**, and deliberately promote…". **This is where the citations rail + chips mount.**

- `lib/artifactsApi.ts`: `ArtifactDelivery` interface (`:6`) + `getArtifact` (`:62`, calls `/api/artifacts/{id}`
  with the user session). **A5 adds `provenance`/citations to this type.**
- Secondary surface: `components/pro-suite/virtual-cso/ArtifactDeliveryCard.tsx` (the in-chat delivery card) —
  optional; the library Preview is the primary A5 home.

## §4 Reuse map

- **A0** `from_provenance_ref` — normalize stored `source_refs` → `CitationRef`.
- **A2** resolvers + `POST /api/citations/resolve` (now `get_current_user_id`, A4) — chip → sidecar.
- **A3** chip + `CitationReaderBody` sidecar components — reuse for the artifact Preview; `[[Source:]]`/`[n]`
  parse from `MessageBubble`'s logic if the artifact body carries inline markers.

## §5 Key differences from VCSO (A1/A3)

- **Static, not streamed.** Artifact citations are stored provenance on a finished artifact — there is **no A1
  turn loop, no streaming, no ordinal binding at answer time.** The citation set = the artifact's provenance
  `source_refs` (+ any inline markers already in the saved body).
- **Numbering:** number the provenance `source_refs` for display like A1's dedup+ordinal, but computed at
  render/delivery time from the stored set, not from a live turn.
- **Derived refs** in provenance are not rendered as chips (O1 consistency).

## §6 Scope discipline

Plumb + render + reuse only. No new provenance capture (Ep6 owns it), no verification (A4 is VCSO-scoped for
now), no geometry (Ep7B), no visual polish (§8). Legacy/no-provenance artifacts degrade to no-citations, no error.
