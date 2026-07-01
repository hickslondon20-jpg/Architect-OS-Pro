# Phase 4 — Live Verification Pass (build-ready)

**Purpose:** confirm the actual current shape of the app's information architecture, design system,
and skill data format before designing skill creation + the Skills Library surface. Performed
2026-07-01. **This pass found more open questions than Phases 1–3 — flagged in `CONTEXT.md` §2 for a
checkpoint before full plan files are written, rather than guessed at.**

---

## 1. IA placement does not match the original discuss-phase assumption

Project `CONTEXT.md` §5 describes the Skills Library as "a third top-level area, alongside Chat and
the existing Documents/Uploads surface." **That assumption doesn't match the live app.** There is no
top-level "Chat" or "Documents/Uploads" sidebar entry at all (`components/Sidebar.tsx` — confirmed by
reading the full nav item list: Dashboard, Foundations, Diagnostics, ArchitectOS Pro Suite,
Resources). Virtual CSO chat and document/KB browsing both live **nested inside** `/pro/intelligence`
(`App.tsx` lines 243–269):

```
/pro/intelligence            → IntelligenceLanding (a "three peers" tile picker)
/pro/intelligence/virtual-cso → Virtual CSO chat
/pro/intelligence/os-engine   → OS Engine (KB Explorer / document upload lives here)
/pro/intelligence/domain-agents → Domain Agents (+ nested gallery/tasks/artifacts routes)
```

`pages/ProSuite/IntelligenceLanding.tsx` explicitly frames these three as a fixed set: copy reads
"**Three** intelligence peers: open strategic reasoning, durable business memory, and specialist
production workflows" and "**Three** tools, always in context." **Adding a fourth peer tile changes
copy that was deliberately written as "three."** This isn't a blocker, but it's a real content
decision, not a drop-in.

**Two placement options, not yet decided:**
- **(A)** Skills Library becomes a fourth peer at `/pro/intelligence/skills`, following the exact
  same `FeatureGate` + locked-component pattern already used for `virtual-cso`/`os-engine` — requires
  updating `IntelligenceLanding.tsx`'s copy from "three" to "four" and adding a fourth tile.
  New `FeatureKey` needed in `lib/featureGates.ts` (e.g. `skills_library`), following the exact
  `virtual_cso`/`os_engine` pattern (`unlockWeek`, `PATH_FEATURE_GATES` entry).
- **(B)** Skills Library becomes a tab/section *within* the existing Virtual CSO workspace (since
  skills are a Virtual CSO concept today — `classify()`/`scoreSkill()` live entirely in
  `api/vcso/chat.ts`) rather than a sibling peer — avoids touching the "three peers" framing at all.

Flagging both rather than picking one — this is a genuine product-framing call, not an engineering
one.

## 2. Real SKILL.md frontmatter shape (confirmed against actual installed skills, not assumed)

Read a real, currently-installed `SKILL.md` file directly (the `docx` skill in this very Cowork
environment) to confirm the open standard's actual frontmatter shape, rather than assuming it from
the name:

```yaml
---
name: docx
description: "Use this skill whenever..."
license: Proprietary. LICENSE.txt has complete terms
---
# Markdown body follows
```

**Only `name` and `description` are the base standard's required frontmatter fields; `license` is
optional and not relevant here** (founders aren't licensing/distributing skills to each other —
Architect CONTEXT.md already forbids team/multi-user sharing). This maps directly onto
`skill_packs`' *already-existing* columns:

| SKILL.md frontmatter | `skill_packs` column |
|---|---|
| `name` | `name` (already exists) |
| `description` | `description` (already exists) |
| *(none in base standard)* | `domain`, `skill_kind`, `trigger_tags`, `required_platform_context` — ArchitectOS-specific extensions, not part of the base standard |

**Recommendation:** export frontmatter = `name` + `description` (base-standard-compliant) plus the
ArchitectOS-specific columns as additional custom YAML keys (the standard doesn't forbid extra
frontmatter fields — the linter-style tools that consume SKILL.md read only what they know and ignore
the rest). Import = `name`/`description` required; the ArchitectOS-specific keys optional, defaulting
sensibly (`trigger_tags: []`, `domain: null`, etc.) if absent — so a genuinely vanilla, third-party
SKILL.md still imports without erroring. `body` = the markdown content below the frontmatter,
unchanged, stored exactly as-is in `skill_packs.body` (already TEXT, already the confirmed native
storage format per project `CONTEXT.md` §5).

## 3. No existing ZIP handling anywhere in the codebase

Searched `python-backend/` for any `zipfile`/`ZipFile` usage — **none found.** ZIP import/export
(SKILL-03, SKILL-04) is genuinely new capability, not a reuse case. Python's stdlib `zipfile` module
needs no new dependency; this is new code, not new infrastructure.

**Where should ZIP handling live?** The existing ingestion pattern (`python-backend/main.py`
`/api/ingest`, `require_ingest_secret`-gated) is the precedent for "upload something, Python backend
processes it, writes to Supabase Storage + a metadata table." Recommend a parallel
`/api/skills/import` (ZIP → parse SKILL.md + categorize `scripts/`/`references/`/`assets/` files →
write `skill_packs` row + `skill_files` rows + upload to the `skill-files` bucket) and
`/api/skills/{id}/export` (reverse: assemble `skill_packs` row + its `skill_files` into a ZIP,
stream back) on the Python backend, mirroring the ingestion endpoint's auth/shape — not a
client-side-only (browser JSZip) implementation, since the founder's own Supabase Storage access
already requires server-side credentials for the `skill-files` bucket writes anyway.

## 4. AI-guided creation flow — "save-skill tool call" needs a concrete contract

Project `CONTEXT.md` §5 says the AI-guided flow "mirrors the Cowork/Claude Code skill-creator
experience" and "produces a valid `skill_packs` row via a save-skill tool call." **No such tool
exists yet anywhere in `api/vcso/chat.ts`** — Virtual CSO today has no tool-calling loop at all (it's
a single-turn stream-completion handler with pre-computed context, not an agentic tool-loop). Adding
a `save_skill` tool means either (a) building a lightweight tool-call turn into the existing chat
handler specifically for this flow, or (b) a separate, dedicated conversational surface (not the main
Virtual CSO chat) purpose-built for skill creation, with its own simpler request/response shape (no
streaming needed, no KB Explorer delegation, no persistent-tool-memory concerns — closer to a
structured multi-turn form than a general chat). **(b) is simpler and lower-risk** given Virtual CSO
chat has no existing tool-loop architecture to extend safely; recommend that but flag it — this
wasn't decided in the original Discuss/Plan session, only that the *experience* should mirror
Cowork/Claude Code's skill-creator.

## 5. Existing infrastructure this phase reuses (confirmed, not re-derived)

- `skill_packs` schema, ownership/scope, RLS, write-lock trigger — Phase 1, done, verified.
- `skill-files` bucket + `skill_files` metadata table + RLS (owner-only private, admin-only-write
  global) — Phase 1, done, verified.
- `classify()`/`detectExplicitSkillInvocation()` — Phase 3, done, verified. A newly-created skill
  becomes immediately usable via `@slug` or ranked scoring with zero Phase 4 changes to routing.
- ArchitectOS design tokens — `DESIGN-GUIDE-QUICK.md` (this repo) is the condensed canonical
  reference; full spec at `../ArchitectOS Beta Launch/ArchitectOS Design System/`. Confirmed current
  and matches the tokens already used in `IntelligenceLanding.tsx` (`--aos-brass`, `--bg-surface`,
  `aos-h1`/`aos-body`/`aos-eyebrow` utility classes, `Card` component from `components/ui`) — build
  any new UI using these exact classes/components, not ad hoc Tailwind.

---
*Verification performed 2026-07-01 against the live `ArchitectOS Pro_beta` codebase (`App.tsx`,
`components/Sidebar.tsx`, `lib/featureGates.ts`, `pages/ProSuite/IntelligenceLanding.tsx`,
`python-backend/`) and a real installed `SKILL.md` file. No production code was written during this
pass.*
