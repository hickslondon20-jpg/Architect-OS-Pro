# A6 RESEARCH — Acceptance matrix + live-DB apply runbook + L18 debt

**Extraction target:** what Ep7A must prove end-to-end, the exact live-DB changes to apply (in the London
session), and the L18 credential debt to fold in. **Re-verify anchors before running.** Verified 2026-07-06.

---

## §1 Acceptance matrix (family × surface)

For each family, exercise: query/answer → chip → sidecar `POST /api/citations/resolve` → Check-Citations
verdict. Surfaces: **VCSO** (A1/A3/A4) and **artifact library** (A5).

| Family | Lit today? (DP5 / CONTEXT §2) | VCSO | Artifact library | Notes |
|---|---|---|---|---|
| `document_chunk` | **Lit** — `retrieval.hybrid_search` + `kb_read`/`retrieve` | ✓ | ✓ | line-level (no geometry until Ep7B) |
| `wiki_page` | **Partial** — wiki read tools + `_build_context`; router is the frontier | ✓ where surfaced | ✓ | claim → `get_claim`, page → `get_page` |
| `platform_record` | **Partial** — structured query + Tier 0 in context | ✓ where surfaced | ✓ | `reflection_reviews` **dormant** (A2) |
| `web` | **Dark** — no registered producer (O2) | pending-producer | pending-producer | resolver returns typed dark |
| `derived` | n/a | trace only (O1) | not a chip | never a citation |

Dark/dormant families are **marked, not failed**. Verifier (A4): a planted unsupported claim → `unsupported`,
faithful quote → `supported`, unreadable → `unresolvable`.

## §2 Live-DB apply runbook (GATED — apply only in the London working session)

**Do NOT apply autonomously.** These mutate the shared Supabase project. Apply order + idempotency + verify:

### R1 — `docs/migrations/20260706_vcso_message_citations.sql` (A1/A4)
```sql
alter table public.vcso_chat_messages
  add column if not exists citations jsonb not null default '[]'::jsonb;
```
- Additive, idempotent. Verdicts (A4) ride inside these `citations` entries — no separate column.
- **Verify:** `select column_name from information_schema.columns where table_name='vcso_chat_messages' and column_name='citations';`

### R2 — `docs/migrations/20260706_citation_verifier_model_setting.sql` (A4)
- Upserts `ai_models` row `claude-3-5-haiku-latest` (family `utility`, cost_tier `low`) + `platform_ai_settings`
  row `citation_verifier`. Idempotent (`on conflict … do update`).
- **Dependency to confirm first:** tables `public.ai_models` + `public.platform_ai_settings` exist with the
  referenced columns. **Verify after:** `select setting_key, fallback_model_name from public.platform_ai_settings where setting_key='citation_verifier';`

### R3 — A2 platform-table confirmation (schema check, no migration)
Confirm existence + key columns of the 15 registry tables: `mra_checkpoints`,
`gm_assessment_checkpoint_scores`, `ae_assessments`, `ae_dimension_scores`, `ae_assessment_insights`,
`sp_sprint_goals`, `sp_sprint_initiatives`, `sp_sprint_milestones`, `quarter_map_selections`, `cc_versions`,
`cc_synthesis`, `clarity_compass_versions`, `reflection_reviews`, `founder_dataset_rows`,
`founder_dataset_rows_v`. **Expected findings:** `reflection_reviews` **likely absent** (Reflection Review not
wired — mark its renderer dormant); check `cc_versions` vs `clarity_compass_versions` aren't duplicative. For any
absent table, mark that renderer dormant (DP5 — yields no refs, no error).
- **Verify:** `select table_name from information_schema.tables where table_schema='public' and table_name = any(array[...]);`

## §3 L18 credential debt (fold in)

L18: Ep5/§8 live-credential verification (sandbox execution / tool loop / credentials) did not gate Ep6 and
rolls into this consolidated smoke. Gather the outstanding items (sandbox verify, live tool-loop credential
checks), run what's runnable without shared-project mutation, mark the rest pending-live. Not a build — a smoke.

## §4 Apply posture

- **Track 1 (harness/smoke)** is autonomous and mutates nothing shared — run against local/test fixtures or a
  Supabase **branch** DB if needed.
- **Track 2 (R1–R3)** is a **London working session.** The strategy thread + London apply via the Supabase MCP
  (`apply_migration` / `execute_sql` read-only for the verifies), one at a time, with the verify query after
  each. All three are idempotent / read-only-safe. No backfill anywhere (L10).
