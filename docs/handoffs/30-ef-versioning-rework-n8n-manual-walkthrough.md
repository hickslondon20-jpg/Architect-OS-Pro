# #30 — Manual n8n Walkthrough: WF-AS-02 (Economic Foundation) Synthesis

> **Who does this:** London, by hand in n8n. These are manual edits to the **existing** `WF-AS-02 - Economic Foundation` workflow (id `bFSs8k8vibjXTPix`). **Not a rebuild.** Same set of edits as the WF-AS-01 walkthrough (#29) — see `docs/handoffs/29-mf-versioning-rework-n8n-manual-walkthrough.md` for the reference; this notes the EF specifics.
> **Why:** dedupe + versioning move to the frontend + a DB trigger (#30). The workflow stops keying on `snapshot_instance_id` (which collides across EF versions) and instead **synthesizes the row it's handed by `id` and writes back**. The frontend now POSTs `{ id, user_id }`.
> **Good news vs WF-AS-01:** the model is **already** `claude-sonnet-4-6` (no model fix needed), and the Anthropic node already reads the financial fields from `Fetch Economic Foundation Data` (the base table — no readable view). Fewer edits than WF-AS-01.
> **Target end-state flow:** Webhook → Check Auth → Validate & Normalize → Check Validation → **Upsert Status Running** → Fetch Economic Foundation Data → Anthropic Call 1 → Parse & Validate JSON → Switch on Status → Supabase Success / Supabase Error → Response.

---

## Step 0 — Safety
Duplicate the workflow (or note current `versionId` `9bff5684-812d-42d5-be5f-650727e28cf1`) so you can revert. Make the edits, **Save**, leave for the post-build test.

## Step 1 — Delete the idempotency cluster (5 nodes)
Delete: **Get Existing Record**, **Normalize Existing Record**, **Check Idempotency**, **Format Skip Response**, **Skip Response (200)**.

## Step 2 — Rewire the validation branch
- **Check Validation** (true) → **Upsert Status Running**
- **Check Validation** (false) → **Validation Failed (400)** (unchanged)

## Step 3 — Simplify "Validate & Normalize" (Code node)
Replace the node's code with (require `id` + `user_id`, drop the hash):
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

**Upsert Status Running** (update, `agency_snapshot_economic_foundation`)
- Filter: `id` `eq` `={{ $('Validate & Normalize').item.json.id }}`
- Fields: keep `synthesis_status = running`. **Remove** the `input_hash` field (frontend owns it). `user_id` set optional — fine to keep or drop.

**Fetch Economic Foundation Data** (getAll, base table, limit 1)
- Filter: `id` `eq` `={{ $('Validate & Normalize').item.json.id }}`
- (The Anthropic node already reads `$('Fetch Economic Foundation Data').item.json.*` — no change to those references.)

**Supabase - Success** (update)
- Filter: `id` `eq` `={{ $json.id }}`
- Keep the 7 beat/headline/signal writes + `synthesis_payload` + `synthesis_status=complete` + `synthesis_generated_at` + `synthesis_model` + `prompt_version`.
- **Remove** the `is_current` field write (frontend + DB trigger own it). **Remove** the `input_hash` field write.

**Supabase - Error** (update)
- Filter: `id` `eq` `={{ $json.id }}`
- Keep `synthesis_status=error`, `synthesis_error`. *(Optional parity with WF-AS-01: also set `synthesis_generated_at = {{ $now.toISO() }}`.)*

## Step 5 — Carry `id` through Parse & add robust error handling

**Parse & Validate JSON** (Code node) — change both returns to carry `id` instead of `snapshot_instance_id`, and make the error check robust:
- Success return: `id: $('Validate & Normalize').first().json.id` (drop `snapshot_instance_id` and `input_hash`).
- Error return: `id: $('Validate & Normalize').first().json.id`.
- Replace the first error check:
  ```js
  if (anthropicResponse.error) {
     const em = typeof anthropicResponse.error === 'string'
       ? anthropicResponse.error
       : (anthropicResponse.error.message || JSON.stringify(anthropicResponse.error));
     throw new Error(em);
  }
  ```
- (Downstream Switch / Success / Error reference `$json.id` per Step 4.)

## Step 6 — Failure hardening on the Anthropic node
**Anthropic Call 1 → Settings → On Error → "Continue (using regular output)".** On failure the error item flows into `Parse & Validate JSON`, which routes it to `Supabase - Error` (writes `synthesis_status='error'`) instead of stranding the row on `running`. **Model stays `claude-sonnet-4-6` — no change.**

## Step 7 — Error Response (500)
Change the response body to use `id`:
`={{ { status: "error", id: $json.id, reason: $json.error_message } }}`

## Step 8 — Auth / secret
Leave the `x-architectos-secret` check as-is (parked).

## Step 9 — Save + sanity
Save. Confirm the canvas reads: Webhook → Check Auth → Validate & Normalize → Check Validation → Upsert Status Running → Fetch Economic Foundation Data → Anthropic Call 1 → Parse & Validate JSON → Switch on Status → Supabase Success / Error → Responses, no orphaned nodes. Hold for the post-build end-to-end test (net-new EF combination → `running` → `complete`; reactivate a prior combination → `is_current` flips, no workflow call).

---

## What the orchestrator will verify afterward (written, no screenshots)
Re-read WF-AS-02 via the n8n MCP: idempotency cluster gone; all Supabase filters use `id`; `Supabase - Success` drops `is_current`/`input_hash`; `Parse` carries `id` + robust error extraction; `Anthropic Call 1` `onError='continueRegularOutput'`; Error Response uses `id`. Then a live execution writes beats + `synthesis_status='complete'` to the correct row `id`.
