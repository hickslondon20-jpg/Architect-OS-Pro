# Phase 6 Research: Artifacts & Delivery Experience

**Verified 2026-07-01.** Live-codebase and live-Supabase check before any plan file is written, per
standing process. Phase 5 (Sandbox Infrastructure) is done and independently re-verified — see that
phase's `STATE.md` entry — so this phase's premise (the sandbox can produce files) is real, not
hypothetical.

## Current state — confirmed by direct search, not assumption

- **No `artifacts` table exists.** Confirmed live via the Supabase MCP: only `gm_report_artifacts`
  matches an `%artifact%` search, and that's the pre-existing, unrelated Growth Mastery PDF-report table
  (N8N + Google Docs merge pipeline, out of scope per the project `CONTEXT.md`'s "not replacing the N8N
  pipeline" rule). The table this phase builds is genuinely new, not a rename.
- **The markdown/HTML rendering panel already exists and is directly reusable — confirmed by reading the
  component, not assumed from its description in the project `CONTEXT.md`.** It's
  `components/pro-suite/shared/Reader.tsx`: a shared collapsible right-hand panel ("Reused by the OS
  Engine workspace and the Virtual CSO workspace" per its own doc comment), rendering a `content: string`
  prop as markdown via `react-markdown`, with `title`/`meta`/`footer` slots and open/close controlled by
  the parent. `VirtualCSOWorkspace.tsx` already wires it via a `readerPageId` state variable (currently
  used for wiki-page citations, opened from `SourcesPanel`). Phase 6 does not need to build a new panel —
  it needs a second way to populate the same `readerPageId`/`readerPage` mechanism, sourced from an
  artifact instead of a wiki page.
- **No file-extraction path exists yet from a sandbox pod back to the Python backend.**
  `python-backend/services/sandbox_service.py` (Phase 5) only captures `stdout`/`stderr`/`exit_code` on
  `SandboxExecutionResult` — there is no code anywhere that pulls a generated file (e.g. a `.pptx` written
  by LLM-generated code) out of the pod. This is new work, not a gap in Phase 5's scope (Phase 5's own
  `CONTEXT.md` explicitly deferred this: "this phase proves the sandbox runs, not that its output reaches
  a founder anywhere").
- **`llm-sandbox` has a documented `copy_from_runtime(src, dst)` method** for pulling files out of a
  session's container, available on the base `SandboxSession` (and, by inheritance,
  `InteractiveSandboxSession`). **Real risk, not hypothetical:** Phase 5 already found the library's
  *default* Kubernetes file-copy mechanism unreliable against this specific cluster — that's why
  `sandbox_service.py`'s `KubernetesInteractiveSandboxSession` subclass overrides `_upload_runner_script`
  to use in-pod `python -c`/`cat`-style exec commands instead of the library's built-in file transfer.
  `copy_from_runtime()` likely rides the same underlying transfer mechanism. Do not assume it works
  unmodified against this cluster — test it directly, early, with the same fallback pattern (base64
  encode via an in-pod exec command, stream out, decode on the host) ready if it isn't reliable.
- **No existing Supabase signed-URL generation code anywhere in `python-backend`** (searched for
  `create_signed_url`/`signed_url` — zero matches). This is new code, but a standard, well-documented
  Supabase Python client call (`storage.from_(bucket).create_signed_url(path, expires_in)`) — no
  precedent to follow in this repo, but no unknowns either.
- **A polymorphic "source" pattern already exists in this schema and should be reused, not reinvented.**
  `agent_context_sources` (from `009_sub_agent_orchestration.sql`) uses `source_kind text not null` +
  `source_id uuid` (nullable, no hard FK — a soft reference) + `source_label text` +
  `source_metadata jsonb`, with a `CHECK` constraint enumerating valid kinds. This is exactly the shape
  ARTIFACT-04 needs ("no Virtual-CSO-only assumptions baked into the schema") — a hard FK to
  `vcso_chat_threads.id` alone would make the table Virtual-CSO-specific, which is exactly what
  ARTIFACT-04 rules out, since Domain Agents' future "Task" concept isn't a chat thread.
- **Storage bucket + RLS precedent confirmed via the actual Phase 1 migration**
  (`20260701_skill_files_storage.sql`): private bucket (`public: false`), a metadata table with
  `storage_path`/`mime_type`/`size`/timestamps + an `updated_at` trigger, and RLS on both the metadata
  table and `storage.objects` keyed by `(storage.foldername(name))[1] = auth.uid()::text`. Unlike
  `skill-files` (which needs an extra "global, open-read" RLS variant for admin-owned skills), `artifacts`
  has no global/shared concept — every artifact belongs to exactly one founder — so the simpler
  `raw-documents`/`kb-files`-style owner-only pattern applies directly, no admin-read variant needed.
- **Migration numbering:** the sequential-number convention (`001`...`010`) is what Phase 5 used most
  recently (`010_sandbox_sessions.sql`) — this phase's migration should be `011_artifacts.sql`, continuing
  that convention rather than switching to the date-prefixed style used elsewhere in the repo.
- **`sandbox_sessions` (Phase 5) RLS is service-role-only** (no founder-facing read/write) — `artifacts`
  is different and needs real founder-facing `SELECT` policies, since the browser client (not just the
  Python backend) needs to read artifact rows to render the Reader panel or request a signed download URL.

## What Phase 6 does NOT need to solve (explicitly out of scope, confirmed against `ROADMAP.md`)

- A browsable "Artifacts Library" UI surface. The Domain Agents architecture memory anticipates one
  ("all artifacts, browsable/downloadable/deletable, gated... preview mode in the artifacts section
  before download") — but that's a future, Domain-Agents-era UX surface, not one of Phase 6's four
  `ROADMAP.md` success criteria. Building it now would be scope creep against the standing "reuse before
  creating, don't over-build" principle. The schema should accommodate it later (ARTIFACT-04), not
  pre-build its UI.
- Deciding *when* a sandbox execution's output should become an artifact. That's Phase 7's job
  (`execute_code` tool wiring decides when to call this phase's delivery path). Phase 6 builds the
  generic mechanism — given a produced file (or files) from a sandbox session, extract it, upload it,
  log it, and return delivery-shaped info (Reader-panel content or chat-card-plus-signed-URL) — verified
  via its own test/verification route, mirroring Phase 5's `/api/sandbox/verify` pattern, not gated on
  Phase 7 existing first.

## Open items for the CONTEXT.md checkpoint

None that block starting `CONTEXT.md` — the above resolves every material unknown research turned up.
One default worth flagging at the checkpoint rather than silently picking: signed URL expiry duration for
the non-renderable delivery path (ARTIFACT-03). Recommendation: 1 hour, matching common practice and long
enough for a founder to click "download" in the same session without being so long it becomes a
standing, unmonitored access grant — easy to change later since it's just a function parameter, not a
schema decision.
