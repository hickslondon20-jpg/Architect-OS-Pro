# #32 — Manual n8n Walkthrough: WF-AS-04 (Delivery Architecture) Synthesis

> **Who does this:** London, by hand in n8n. Manual edits to the **existing** `WF-AS-04 - Delivery Architecture` workflow (id `pFCdviu2Y2wx284v`). **Not a rebuild.** Identical edits to the WF-AS-02/03 walkthroughs — see `docs/handoffs/30-ef-versioning-rework-n8n-manual-walkthrough.md` for the reference; only the node/table names differ.
> **Why:** dedupe + versioning move to the frontend + a DB trigger (#32). The workflow stops keying on `snapshot_instance_id` (collides across versions) and **synthesizes the row it's handed by `id` and writes back**. The frontend now POSTs `{ id, user_id }`.
> **Already correct (verified):** model `claude-sonnet-4-6` (no model fix), and the Anthropic node already reads the delivery fields from `Fetch Delivery Architecture Data` (base table — no readable view).
> **Target end-state flow:** Webhook → Check Auth → Validate & Normalize → Check Validation → **Upsert Status Running** → Fetch Delivery Architecture Data → Anthropic Call 1 → Parse & Validate JSON → Switch on Status → Supabase Success / Error → Response.

---

## Step 0 — Safety
Duplicate (or note current `versionId` `81acba90-629a-4d58-8f50-c9809fa4d662`) so you can revert. Edit, **Save**, **Publish**, leave for the post-build test. *(Reminder from #31: confirm the **active/published** version is the reworked one before testing.)*

## Step 1 — Delete the idempotency cluster (5 nodes)
Delete: **Get Existing Record**, **Normalize Existing Record**, **Check Idempotency**, **Format Skip Response**, **Skip Response (200)**.

## Step 2 — Rewire the validation branch
- **Check Validation** (true) → **Upsert Status Running**
- **Check Validation** (false) → **Validation Failed (400)** (unchanged)

## Step 3 — Simplify "Validate & Normalize" (Code node)
Replace the code with (require `id` + `user_id`, drop the hash):
```js
const data = $('Webhook Trigger').item.json.body;

if (!data.id || !data.user_id) {
  return [{ json: { valid: false, reason: "missing_id_or_user_id" } }];
}

return [{ json: {
  valid: true,
  id: data.id,
  user_id: data.user_id
} }];
```

## Step 4 — Re-key the Supabase nodes `snapshot_instance_id` → `id`
For **each** of these nodes, set the filter **field (keyName) to `id`** (not just the value):

**Upsert Status Running** (update, `agency_snapshot_delivery_architecture`)
- Filter: `id` `eq` `={{ $('Validate & Normalize').item.json.id }}`
- Fields: keep `synthesis_status = running`. **Remove** the `input_hash` field. `user_id` optional.

**Fetch Delivery Architecture Data** (getAll, base table, limit 1)
- Filter: `id` `eq` `={{ $('Validate & Normalize').item.json.id }}`

**Supabase - Success** (update)
- Filter: `id` `eq` `={{ $json.id }}`
- Keep the 7 beat/headline/signal writes + `synthesis_payload` + `synthesis_status=complete` + `synthesis_generated_at` + `synthesis_model` + `prompt_version`.
- **Remove** the `is_current` and `input_hash` field writes.

**Supabase - Error** (update)
- Filter: `id` `eq` `={{ $json.id }}`
- Keep `synthesis_status=error`, `synthesis_error`. *(Optional parity: add `synthesis_generated_at = {{ $now.toISO() }}`.)*

> ⚠️ From #31: make sure the **field/keyName** itself changes to `id` on every node above — not only the value expression. A node left with keyName `snapshot_instance_id` but value `.id` filters on the wrong column and updates 0 rows.

## Step 5 — Carry `id` through Parse & add robust error handling
**Parse & Validate JSON** (Code node):
- Both returns: carry `id: $('Validate & Normalize').first().json.id` (drop `snapshot_instance_id` and `input_hash`).
- Replace the first error check:
  ```js
  if (anthropicResponse.error) {
     const em = typeof anthropicResponse.error === 'string'
       ? anthropicResponse.error
       : (anthropicResponse.error.message || JSON.stringify(anthropicResponse.error));
     throw new Error(em);
  }
  ```

## Step 6 — Failure hardening on the Anthropic node
**Anthropic Call 1 → Settings → On Error → "Continue (using regular output)".** Model stays `claude-sonnet-4-6` — no change.

## Step 7 — Error Response (500)
Change the response body to use `id`:
`={{ { status: "error", id: $json.id, reason: $json.error_message } }}`

## Step 8 — Auth / secret
Leave the `x-architectos-secret` check as-is (parked).

## Step 9 — Save + **Publish** + sanity
Save **and Publish** (so the active version = the reworked draft — this is the step that was missed on WF-AS-03). Confirm the canvas reads: Webhook → Check Auth → Validate & Normalize → Check Validation → Upsert Status Running → Fetch Delivery Architecture Data → Anthropic Call 1 → Parse & Validate JSON → Switch on Status → Supabase Success / Error → Responses, no orphaned nodes. Hold for the post-build end-to-end test.

---

## What the orchestrator will verify afterward (written, no screenshots)
Re-read WF-AS-04 via the n8n MCP and confirm the **active/published** version: idempotency cluster gone; all Supabase filters use keyName `id`; `Supabase - Success` drops `is_current`/`input_hash`; `Parse` carries `id` + robust error extraction; `Anthropic Call 1` `onError='continueRegularOutput'`; Error Response uses `id`. Then a live execution writes beats + `synthesis_status='complete'` to the correct row `id`.
