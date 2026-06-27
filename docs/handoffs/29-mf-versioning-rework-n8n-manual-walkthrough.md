# #29 — Manual n8n Walkthrough: WF-AS-01 (Market Footprint) Synthesis

> **Who does this:** London, by hand in n8n. Cowork/Code can only *create* workflows, not edit individual nodes — so these are manual edits to the **existing** `WF-AS-01 - Market Footprint` workflow (id `JZlFwB65zkntPdIE`). **We are not rebuilding it.** This is a small set of edits: delete the idempotency cluster, re-key everything from `snapshot_instance_id` → `id`, and drop the now-frontend-owned hash/`is_current` writes.
> **Why:** With #29, dedupe + versioning move to the frontend + a DB trigger (Option A). The workflow no longer detects "already synthesized" or owns `is_current` — it just **synthesizes the row it's handed (by `id`) and writes the result back.** The frontend now POSTs `{ id, user_id }` (no `snapshot_instance_id`, no `force`, no hash).
> **Target end-state flow:** Webhook → Check Auth → Validate & Normalize → Check Validation → **Upsert Status Running** → Fetch Readable Labels → Anthropic Call 1 → Parse & Validate JSON → Switch on Status → Supabase Success / Supabase Error → Response.

---

## Step 0 — Safety

- Duplicate the workflow first (n8n: **Duplicate**) as a backup, or note the current `versionId` (`6a871f4c-43a7-4ae6-86a0-60ce3d287d24`) so you can revert.
- Do these edits, **Save**, then leave it for the post-build end-to-end test.

---

## Step 1 — Delete the idempotency cluster (5 nodes)

Delete these nodes entirely:

1. **Get Existing Record**
2. **Normalize Existing Record**
3. **Check Idempotency**
4. **Format Skip Response**
5. **Skip Response (200)**

These existed to detect "already synthesized." Dedupe now happens at save (the frontend won't even call the workflow for a cached combination), so they're dead weight — and their hash was degenerate anyway.

---

## Step 2 — Rewire the validation branch

After deleting the cluster, the **Check Validation** node's *true* output is dangling. Reconnect it:

- **Check Validation** (true / valid) → **Upsert Status Running**
- **Check Validation** (false / invalid) → **Validation Failed (400)** (unchanged)

So a valid request now flows straight into "set status running."

---

## Step 3 — Simplify "Validate & Normalize" (Code node)

The hash is no longer needed (frontend owns it), and the only required inputs are `id` + `user_id`. Replace the node's code with:

```js
const data = $('Webhook Trigger').item.json.body;

// Require the version row id + user
if (!data.id || !data.user_id) {
  return [{ json: { valid: false, reason: "missing_id_or_user_id" } }];
}

return [{ json: {
  valid: true,
  id: data.id,
  user_id: data.user_id
} }];
```

(Website URL / positioning context are read from the readable view downstream — see Step 5 — so they no longer need to come through the payload.)

---

## Step 4 — Re-key the Supabase nodes from `snapshot_instance_id` → `id`

Update the filter on each remaining Supabase node so it targets the row by `id`:

**Upsert Status Running** (operation: update, table `agency_snapshot_market_footprint`)
- Filter: `id` `eq` `={{ $('Validate & Normalize').item.json.id }}`
- Fields to set: `synthesis_status = running` (keep). **Remove** the `input_hash` field write (frontend owns the hash). `user_id` set is optional — fine to keep or drop.

**Fetch Readable Labels** (operation: getAll, table `agency_snapshot_market_footprint_readable`, limit 1)
- Filter: `id` `eq` `={{ $('Validate & Normalize').item.json.id }}`
- (The readable view exposes `id`, so this works; it also exposes `website_url` and `positioning_context` for Step 5.)

**Supabase - Success** (operation: update)
- Filter: `id` `eq` `={{ $json.id }}`
- Keep the seven beat/headline/signal writes + `synthesis_payload` + `synthesis_status = complete` + `synthesis_generated_at`.
- **Remove** the `is_current` field write (frontend + DB trigger now own `is_current`).
- **Remove** the `input_hash` field write (frontend owns it).
- `synthesis_model` / `prompt_version` — keep (provenance). See Step 6 re: the model label.

**Supabase - Error** (operation: update)
- Filter: `id` `eq` `={{ $json.id }}`
- Keep `synthesis_status = error`, `synthesis_error`, `synthesis_generated_at`.

---

## Step 5 — Point the carry-through `id` and the Anthropic inputs at the right places

**Parse & Validate JSON** (Code node) — it currently carries `snapshot_instance_id`. Change both returns to carry `id` instead:
- Success return: replace `snapshot_instance_id: $('Validate & Normalize').first().json.snapshot_instance_id` with `id: $('Validate & Normalize').first().json.id`. You can drop the `input_hash` field from this return too.
- Error return: replace `snapshot_instance_id: …` with `id: $('Validate & Normalize').first().json.id`.
- (The downstream Switch / Success / Error nodes reference `$json.id` per Step 4.)

**Anthropic Call 1** — the user-message template currently reads website/context from `Validate & Normalize`'s `normalized_data`, which no longer exists. Repoint those two lines to the readable fetch:
- `Website: {{ $('Fetch Readable Labels').item.json.website_url }}`
- `Additional Context Provided: {{ $('Fetch Readable Labels').item.json.positioning_context }}`
- The five label lines (agency types, services, industries, geo, pricing) already read from `Fetch Readable Labels` — leave them.

---

## Step 6 — Optional but recommended: fix the model-label stamp

The Anthropic node runs model id `claude-sonnet-4-20250514`, but **Supabase - Success** stamps `synthesis_model = 'claude-sonnet-4-6'`. Set `synthesis_model` to the value you want recorded as provenance (the actual id, or your canonical label) so the stamp matches reality. Prompt stays inline with `prompt_version = 'v1'` for now — it becomes the seed when we stand up the prompt registry.

---

## Step 7 — Auth / secret (no change now)

Leave the `x-architectos-secret` check as-is. (Moving it to an env-resolved value is a separate parked item; when we do it, the workflow's `Check Auth` IF and the frontend header must change together.)

---

## Step 8 — Save + sanity

- **Save** the workflow.
- Confirm the canvas now reads: Webhook → Check Auth → Validate & Normalize → Check Validation → Upsert Status Running → Fetch Readable Labels → Anthropic Call 1 → Parse & Validate JSON → Switch on Status → Supabase Success / Error → Responses, with no orphaned nodes.
- Hold for the **post-build end-to-end test** (after the frontend + trigger land): we'll create a net-new combination, watch it insert + go `running` → `complete`, then reactivate a prior combination and confirm it flips `is_current` **without** hitting the workflow.

---

## What the orchestrator will verify afterward (written, no screenshots)

Re-read WF-AS-01 via the n8n MCP to confirm: the five idempotency nodes are gone; all Supabase filters use `id`; `Supabase - Success` no longer writes `is_current`/`input_hash`; the Anthropic website/context inputs read from the readable view; and one live execution writes the beats + `synthesis_status='complete'` to the correct row `id`.
