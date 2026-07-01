# Sub-phase 06 — Research: Corrections Lifecycle, Activity Log, Health/Lint

**Verify-pass date:** 2026-06-30
**Verified by:** Orchestration agent
**Status:** Complete — ready for execution

---

## 1. What the Verify Pass Found

The sub-phase 06 ROADMAP entry reads: "correction override-preservation lifecycle, activity
log, health/lint feeding the UI." The verify pass discovered that **two of three items were
already built by the sub-phase 03 execution agent** beyond the minimum spec:

| Item | Expected state | Actual state |
|---|---|---|
| Corrections lifecycle | Not built | ✅ Fully implemented in `doc_wiki_synthesis.py` |
| Activity log writes | Not built | ✅ Fully implemented in `doc_wiki_synthesis.py` |
| Health/lint service | Not built | ❌ Does not exist — the main new deliverable |

Additionally, a minor issue was found:

| Issue | Description |
|---|---|
| Icon name mismatch | `_log_icon()` returns kebab-case strings; `LogView.tsx` ICONS registry uses PascalCase — entries always fall back to `Activity` icon |
| Missing migration docs | `ose_page_corrections` and `ose_activity_log` are referenced by code but have no corresponding `docs/migrations/` file |

Sub-phase 06 is therefore **narrower than planned**. The three deliverables are:

1. **`DocWikiHealthService`** — the only substantively new build
2. **Icon alignment fix** — `LogView.tsx` ICONS registry (one-liner frontend change)
3. **Migration documentation** — `CREATE TABLE IF NOT EXISTS` for `ose_page_corrections` +
   `ose_activity_log` (schema record-keeping; safe to apply since tables exist in live DB)

---

## 2. What the Sub-phase 03 Agent Already Built (DO NOT REBUILD)

### 2.1 Corrections lifecycle — fully implemented

**`_pending_corrections(page_id, user_id)`** (line 485):
Reads `ose_page_corrections` for the page being re-synthesized:
```python
self._store.client.table("ose_page_corrections")
    .select("id,body")
    .eq("user_id", user_id)
    .eq("page_id", page_id)
    .eq("status", "pending")
    .execute()
```

**`_pending_correction_context(user_id)`** (line 528):
Includes all user's pending corrections in every synthesis prompt — so Claude is aware of
what the founder has flagged even before a specific page is re-synthesized.

**`_apply_corrections_overlay(content, correction_rows)`** (line 700):
Appends corrections as a `## Founder Corrections Preserved` section at the bottom of
the synthesized content — transparent, parseable, survives the upsert.

**`_mark_corrections_applied(correction_rows)`** (line 500):
After a page upsert, sets `status='applied'` on the corrections that were included.
Logged as a `[CORRECTIONS_APPLIED]` decision event in `ose_activity_log`.

**Frontend `addPageCorrection()`** in `lib/osEngineApi.ts` (line 495):
Inserts to `ose_page_corrections` with `{user_id, page_id, body}`. `status` defaults to
`'pending'`. The `NotesComposer` UI component in `OSEngineWorkspace.tsx` already calls this.

**The full corrections loop is operational.** Sub-phase 06 does NOT touch it.

### 2.2 Activity log — fully implemented

**`_write_log(user_id, kind, text, result)`** (line 366):
Inserts to `ose_activity_log` with `{user_id, kind, text, icon}`.

Icon determination via `_log_icon(kind, text)` (line 761):
```python
def _log_icon(kind: str, text: str) -> str:
    if kind == "decision" or "CONTRADICTION" in text or "WARNING" in text:
        return "alert-triangle"
    if "ERROR" in text:
        return "x-circle"
    return "file-text"
```

Log events written by the synthesis engine:
- `[SYNTHESIS_SKIPPED]` — decision kind, source or page not worthy
- `[SYNTHESIS_COMPLETE]` — activity kind, one per synthesized page
- `[SYNTHESIS_ERROR]` — activity kind, Claude failure or JSON parse failure
- `[CORRECTIONS_APPLIED]` — decision kind, after corrections overlay
- `[CONTRADICTION_FLAGGED]` — decision kind, from `_flag_contradictions()`

**`manifest_update`** event in `main.py` (line 325):
```python
self._store.client.table("ose_activity_log").insert({"user_id": ..., "kind": "activity",
    "text": "[MANIFEST_UPDATE] ...", "icon": "file-text"})
```

### 2.3 `connected_pages` manifest write — fully implemented

**`_maintain_manifest(payload, page_id)`** (line 258):
For `source_kind == "document"` only, merges `page_id` into `ose_raw_document_registry.connected_pages`.
This is what makes the Manifest view's "Ingested into" column populate.

---

## 3. Icon Name Mismatch (Fix Required)

### 3.1 Root cause

`LogView.tsx` (line 6–12) defines a fixed ICONS registry:
```typescript
const ICONS: Record<string, React.ElementType> = {
  FileCheck2,
  RefreshCw,
  Lightbulb,
  Loader,
  Activity,
};
```

`toLogEntry()` in `osEngineApi.ts` maps `row.icon` to `entry.icon`. When `entry.icon` is
`"file-text"`, `ICONS["file-text"]` is `undefined`, so `LogView.tsx` line 43 always falls
back to `Activity`:
```typescript
const Icon = ICONS[entry.icon] ?? Activity;
```

### 3.2 Fix

Update `LogView.tsx` to add the three icon names the backend produces. This is a
**3-line frontend change** (1 import line + 3 registry entries):

```typescript
import { FileCheck2, RefreshCw, Lightbulb, Loader, Activity,
         AlertTriangle, XCircle, FileText } from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  FileCheck2,
  RefreshCw,
  Lightbulb,
  Loader,
  Activity,
  'alert-triangle': AlertTriangle,   // decisions, contradictions, warnings
  'x-circle': XCircle,               // errors
  'file-text': FileText,             // routine activity events
};
```

Do NOT change `_log_icon()` in the Python backend — the kebab-case icon names are
reasonable and align with Lucide icon naming conventions.

---

## 4. Migration Documentation (Schema Record-Keeping)

### 4.1 Tables that exist but have no migration file

Both `ose_page_corrections` and `ose_activity_log` are referenced by the synthesis engine
and frontend but have no corresponding `docs/migrations/` file. This means the schema is
undocumented locally and an agent starting fresh cannot reconstruct it from migrations.

### 4.2 Inferred schemas (verified from code)

**`ose_page_corrections`** (inferred from `doc_wiki_synthesis.py` + `osEngineApi.ts`):
```sql
create table if not exists public.ose_page_corrections (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  page_id    uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  body       text        not null,
  status     text        not null default 'pending',
  created_at timestamptz not null default now(),
  constraint ose_page_corrections_status_check check (status in ('pending', 'applied'))
);
```

**`ose_activity_log`** (inferred from `doc_wiki_synthesis.py` + `osEngineApi.ts`):
```sql
create table if not exists public.ose_activity_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null default 'activity',
  text       text        not null,
  icon       text,
  created_at timestamptz not null default now(),
  constraint ose_activity_log_kind_check check (kind in ('activity', 'decision'))
);
```

**File to create:** `docs/migrations/20260630_docwiki_corrections_log.sql`

Use `CREATE TABLE IF NOT EXISTS` throughout — the tables already exist in the live DB
(`pwacpjqkntnovndhspxt`). This migration is safe to apply and is purely additive
documentation; it will no-op on the live project.

---

## 5. `DocWikiHealthService` — The Main Deliverable

### 5.1 Purpose

Layer 2 health/lint for `ose_knowledge_pages`. Equivalent to `WikiHealthService`
(Layer 1, `services/wiki_health.py`) but scoped to the doc wiki's data model.

**File:** `python-backend/services/doc_wiki_health_service.py`

### 5.2 Health checks

| Check | How to query | Significance |
|---|---|---|
| `pages_total` | `count(*)` on `ose_knowledge_pages` where `user_id` and `status != 'deleted'` | Baseline |
| `pages_with_embedding` | `count(*)` where `embedding IS NOT NULL` | Searchable pages |
| `pages_without_embedding` | `pages_total - pages_with_embedding` | Can't be found via semantic search |
| `pages_with_pending_corrections` | `count(distinct page_id)` from `ose_page_corrections` where `status='pending'` | Pages needing re-synthesis |
| `contradiction_count` | `count(*)` from `ose_page_links` where `relation='contradicts'` and `user_id` | Flagged contradictions |
| `orphan_pages` | Pages whose `source_file_ids` reference `ose_raw_document_registry` rows with `record_state='deleted'` | Stale provenance |
| `recent_errors` | `count(*)` from `ose_activity_log` where `text LIKE '%SYNTHESIS_ERROR%'` and `created_at > now() - interval '7 days'` | Pipeline health |

### 5.3 Return shape

```python
{
    "schema_version": "doc_wiki_health_v1",
    "user_id": str,
    "checked_at": str,  # ISO timestamp
    "counts": {
        "pages_total": int,
        "pages_with_embedding": int,
        "pages_without_embedding": int,
        "pages_with_pending_corrections": int,
        "contradiction_count": int,
        "orphan_pages": int,
        "recent_errors_7d": int,
    },
    "status": "healthy" | "needs_attention" | "degraded",
    "flags": list[str],  # human-readable issues, e.g. "12 pages have no embedding"
}
```

**Status determination:**
- `"degraded"` if `recent_errors_7d > 5` OR `pages_without_embedding > 20`
- `"needs_attention"` if any: `pages_with_pending_corrections > 0`, `orphan_pages > 0`,
  `contradiction_count > 0`, `recent_errors_7d > 0`
- `"healthy"` otherwise

### 5.4 Implementation notes

- All queries are read-only; no writes
- Each query wrapped in its own `try/except` — partial failure returns partial data
  with a `query_errors` key listing which checks failed
- `orphan_pages` check: join `ose_knowledge_pages` → unnest `source_file_ids` →
  check each UUID against `ose_raw_document_registry.record_state`. This is a
  multi-step Python query (not a single SQL): load pages with non-empty `source_file_ids`,
  collect all unique source IDs, batch-query `ose_raw_document_registry` to find deleted
  ones, then count pages that reference at least one deleted document.
- Do not load page `content` in any health check — health is metadata-only

### 5.5 Endpoint

```
GET /api/doc-wiki/health/{user_id}
Returns: { "status": "ok", "health": {...} }
```

Add to `main.py` with `require_ingest_secret` dependency.

---

## 6. Hard Rules

1. **Do NOT rebuild the corrections lifecycle** — it's fully built; touching it risks regression
2. **Do NOT rebuild `_write_log()`** — it's fully built and tested (implicitly by other tests)
3. **Migration uses `CREATE TABLE IF NOT EXISTS`** — tables exist live; migration must be idempotent
4. **`DocWikiHealthService` is read-only** — no writes, no mutations, no side effects
5. **`DocWikiHealthService` is a new class** — do not add health methods to `DocWikiReadService`
6. **Icon fix is frontend only** — do not change `_log_icon()` in the Python backend
7. **No new columns on `ose_knowledge_pages`** — health is derived from existing data
8. **Do NOT apply the migration** — write the SQL file to disk only (same pattern as 02–05)

---

## 7. Files Touched

| File | Action | Notes |
|---|---|---|
| `docs/migrations/20260630_docwiki_corrections_log.sql` | CREATE | Schema docs for `ose_page_corrections` + `ose_activity_log` |
| `python-backend/services/doc_wiki_health_service.py` | CREATE | `DocWikiHealthService` + `DocWikiHealthError` |
| `python-backend/main.py` | MODIFY | Add `GET /api/doc-wiki/health/{user_id}` endpoint |
| `components/pro-suite/os-engine/views/LogView.tsx` | MODIFY | Add 3 icon entries + imports |

---

## 8. Success Criteria (12 checks)

| # | Criterion |
|---|---|
| 1 | `docs/migrations/20260630_docwiki_corrections_log.sql` created with `CREATE TABLE IF NOT EXISTS` for both tables |
| 2 | Migration includes correct status CHECK constraint on `ose_page_corrections` |
| 3 | Migration includes correct kind CHECK constraint on `ose_activity_log` |
| 4 | `DocWikiHealthService` class created in `doc_wiki_health_service.py` |
| 5 | `health(user_id)` method returns all 7 counts |
| 6 | `status` field is one of `"healthy"`, `"needs_attention"`, `"degraded"` |
| 7 | `flags` list is populated with human-readable strings for any non-zero issue counts |
| 8 | Any single query failure does not crash the whole health call (each query individually try/except'd) |
| 9 | `GET /api/doc-wiki/health/{user_id}` endpoint added to `main.py` with `require_ingest_secret` |
| 10 | `LogView.tsx` ICONS registry includes `'alert-triangle'`, `'x-circle'`, `'file-text'` entries |
| 11 | `AlertTriangle`, `XCircle`, `FileText` imported in `LogView.tsx` from `lucide-react` |
| 12 | `python -m compileall python-backend` exits 0 |
