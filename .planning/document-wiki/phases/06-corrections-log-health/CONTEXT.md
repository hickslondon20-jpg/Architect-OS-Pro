# Sub-phase 06 — Context: Corrections, Log, Health

**Phase:** 06 — Corrections Lifecycle, Activity Log, Health/Lint
**Status:** Ready for execution
**Verify-pass date:** 2026-06-30

---

## What This Phase Is

Sub-phase 06 completes Layer 2 infrastructure by:

1. Documenting the schema of two tables that exist in the live database but have no local migration file
2. Fixing an icon name mismatch in `LogView.tsx` so the log timeline shows correct icons
3. Building `DocWikiHealthService` — a read-only health/lint check for `ose_knowledge_pages`
4. Adding a `GET /api/doc-wiki/health/{user_id}` endpoint to expose health data

**What this phase is NOT:**
The corrections lifecycle, activity log writes, and manifest update are already fully built by the sub-phase 03 agent. This phase does not touch them.

---

## Verified Inputs (What Already Exists)

| Asset | Location | Verified state |
|---|---|---|
| `ose_page_corrections` table | Live Supabase (`pwacpjqkntnovndhspxt`) | Exists; used by `_pending_corrections()`, `_mark_corrections_applied()`; frontend `addPageCorrection()` inserts to it |
| `ose_activity_log` table | Live Supabase | Exists; `_write_log()` inserts events; `loadOSEngineData()` reads it |
| Corrections lifecycle | `python-backend/services/doc_wiki_synthesis.py` lines 485, 500, 528, 700 | Fully implemented — DO NOT TOUCH |
| Activity log writes | `python-backend/services/doc_wiki_synthesis.py` lines 366, 761 | Fully implemented — DO NOT TOUCH |
| `LogView.tsx` | `components/pro-suite/os-engine/views/LogView.tsx` | Built; ICONS registry is PascalCase; `_log_icon()` produces kebab-case → icon always falls back to `Activity` |
| `require_ingest_secret` dependency | `python-backend/main.py` line 470 | Pattern to reuse for health endpoint |
| `DocWikiReadService` | `python-backend/services/doc_wiki_read_service.py` | Built (sub-phase 05); health service is a separate class |
| Layer 1 `WikiHealthService` | `python-backend/services/wiki_health.py` | Reference implementation for health pattern |

---

## Files This Phase Touches

| File | Action | Description |
|---|---|---|
| `docs/migrations/20260630_docwiki_corrections_log.sql` | CREATE | Schema documentation for `ose_page_corrections` + `ose_activity_log` |
| `components/pro-suite/os-engine/views/LogView.tsx` | MODIFY | Add 3 icon entries to ICONS registry + import 3 new icons |
| `python-backend/services/doc_wiki_health_service.py` | CREATE | `DocWikiHealthService` class |
| `python-backend/main.py` | MODIFY | Add `GET /api/doc-wiki/health/{user_id}` endpoint |

---

## Out of Scope

- The corrections lifecycle methods in `doc_wiki_synthesis.py` — do not touch
- The `_write_log()` / `_log_icon()` methods — do not touch
- `_maintain_manifest()` — do not touch
- Any frontend beyond `LogView.tsx` ICONS registry
- Any new Supabase columns or tables
- Any migration application (write SQL to disk only)

---

## Key Constraints

- `DocWikiHealthService` is **read-only** — no writes, no mutations
- `DocWikiHealthService` is a **separate class** from `DocWikiReadService` — do not merge them
- Each health check query individually wrapped in `try/except` — partial failure does not crash the call
- Migration uses `CREATE TABLE IF NOT EXISTS` — tables exist live; must be idempotent
- Health endpoint uses `require_ingest_secret` dependency — same as all other doc-wiki endpoints
- Do NOT apply the migration — write to disk only
- Do NOT change `_log_icon()` in the Python backend
- `python -m compileall python-backend` must exit 0

---

## Success Criteria (12 checks)

| # | Criterion |
|---|---|
| 1 | `docs/migrations/20260630_docwiki_corrections_log.sql` created with `CREATE TABLE IF NOT EXISTS` for both tables |
| 2 | Migration includes correct status CHECK constraint (`'pending'`, `'applied'`) on `ose_page_corrections` |
| 3 | Migration includes correct kind CHECK constraint (`'activity'`, `'decision'`) on `ose_activity_log` |
| 4 | `DocWikiHealthService` class created in `doc_wiki_health_service.py` |
| 5 | `health(user_id)` method returns all 7 counts |
| 6 | `status` field is one of `"healthy"`, `"needs_attention"`, `"degraded"` |
| 7 | `flags` list populated with human-readable strings for any non-zero issue counts |
| 8 | Any single query failure does not crash the whole health call |
| 9 | `GET /api/doc-wiki/health/{user_id}` endpoint added to `main.py` with `require_ingest_secret` |
| 10 | `LogView.tsx` ICONS registry includes `'alert-triangle'`, `'x-circle'`, `'file-text'` entries |
| 11 | `AlertTriangle`, `XCircle`, `FileText` imported in `LogView.tsx` from `lucide-react` |
| 12 | `python -m compileall python-backend` exits 0 |
