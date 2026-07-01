# Wiki System — Sub-phase 06 FOLLOW-UP: apply live + smoke

> Paste this into the existing Sub-phase 06 execution agent session (opened at `C:\Users\Hicks\ArchitectOS Pro_beta`).

---

Quick correction and completion request. **You have Supabase write access in this session** — it is the
same access that applied the 03 and 04 migrations live and created the `replace_compiled_wiki_page` RPC.
The earlier note that "only `.env.local` anon vars were available" was a mis-assessment of the path:
use your **service-role / Supabase write path** (the one that applied the prior migrations / the Supabase
MCP), **not** the anon browser vars. Project: `Architect OS`, ref `pwacpjqkntnovndhspxt`.

**Sub-phase 06 is not complete until the migration is applied live and the DB smoke passes.** A read-only
audit confirmed the 06 objects are not yet in the database: `wiki_pages.tags` is missing, and `valid_tag`,
`wiki_validation_findings`, and `wiki_health` do not exist live. Finish the assigned task:

1. **Apply** `docs/migrations/20260630_wiki_tags.sql` to live Supabase.
2. **Verify live:** `wiki_pages.tags` exists; `valid_tag` / `wiki_validation_findings` / `wiki_health`
   functions exist; the 7 fixed `wiki_pages` rows are backfilled with default tags; no off-taxonomy
   default tags.
3. **Seed a smoke case** for a temp test user: one broken-provenance claim (a claim with zero evidence)
   and a page carrying an off-taxonomy tag. Run the validation set; confirm **both are flagged, not
   dropped** (rows land in `wiki_validation_findings`).
4. **Run `wiki_health(user_id)` live;** confirm it returns the five dashboards (`open-questions`,
   `contradictions`, `low-confidence`, `claim-health`, `stale-pages`) and that rollup counts land in
   `wiki_digest.digest.counts`.
5. **Confirm the post-compile hook:** run a `compile_page` and confirm `validation_counts` come back and
   the digest counts update.
6. **Clean up** any temporary test rows you created.

**Report back:** confirmation the migration is live, the verify results from steps 2–5, and that 06's six
success criteria now hold against live Supabase.

**Optional — same access unblocks these (deferred earlier for the identical env reason).** If in scope,
also clear:
- **05 live write-surface smoke** — a `propose → promote → demote` round-trip against live RLS + the
  write-lock trigger + actor-scope (unauthorized promotion rejected; compiled-base proposal rejected).
- **Real-embedding check** — if OpenAI quota is restored, a `compile_page` + `wiki_search` run with real
  `text-embedding-3-small` embeddings, confirming semantically relevant ranking.

If those are out of scope for this session, leave them as-is — they are tracked for **08-acceptance**.
Do **not** start sub-phase 07; it is opened from the strategy thread once live state is confirmed solid.
