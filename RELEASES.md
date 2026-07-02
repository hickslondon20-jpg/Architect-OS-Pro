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
