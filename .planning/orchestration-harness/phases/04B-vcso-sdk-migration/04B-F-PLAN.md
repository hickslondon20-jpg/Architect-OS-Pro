# Phase F Plan — First Live MCP (QuickBooks) + Financial-Series for Real Compute

> Read `04B-VISION-AND-INTENT.md` (grade against §4), `../../CONTEXT.md` + `../../ROADMAP.md`, and this
> folder's `CONTEXT.md` (esp. "Data lifecycle for MCP + sandbox") + `ROADMAP.md` first. Covers
> **SDK-F1..F6 + the financial-series piece.** Delivers the harness **Phase 5** live-source objective on
> the SDK path. **One pilot connector only** (QuickBooks). **Refreshed 2026-07-23 against post-D2 state.**

## Sequencing (updated 2026-07-23, London — see `04B-G-GATE-FINDINGS.md`)
**Order is now E → F → G-gate.** F runs **after Phase E** and **before** the G-gate — the reverse of the
original plan. A1 pressure-testing proved the sandbox has no financial series to compute over, so the
generalization proof (G-gate) is **held until F builds that series.** **F is now a hard prerequisite of the
G-gate:** the financial-series store F delivers (§D) is exactly what lets the G-gate's A1 become a real
numeric test. **The big one** — most external dependencies (OAuth, Vault, QuickBooks), most net-new (the
financial-series store + real sandbox compute).

## UNIT F0 ADDED 2026-08-09 — approve aggregate query shapes, FIRST, ahead of the connector

**Source: live evidence, Step 3 smoke, run `5f03966b`. This reorders F's internals; the E → F → G-gate
sequencing above is unchanged.**

`run_structured_query` refused twice inside `structured_data_agent` with `"Query shape is not approved for
structured dataset reads."` (child run `b5cf1351`, steps 4 and 5). **Because aggregate totals cannot be
retrieved, the model derives them by hand** — and hand-derived subtotals are then correctly refused by the
Step 3 compute gate, after which the model computes in prose and publishes uncited figures. That whole
chain starts here.

Orchestrator verification confirmed the model's arithmetic was right (April revenue 41,000; May 44,000;
April delivery cost 10,660; May 12,100 — all exact sums of retrieved rows). **The problem is not accuracy.
It is that a correct aggregate arrives with no provenance because no tool produced it.**

**F0 deliverable:** `validate_structured_sql` approves a bounded set of aggregate shapes (`SUM`, `COUNT`,
`AVG`, `GROUP BY` over period and client dimensions) for founder-scoped structured reads, so a period total
returns **as tool output carrying its citation and dataset-grain provenance**. Founder scoping stays bound
at tool construction and is never model-supplied.

**Why first:** it is the cheapest intervention that dissolves the derivation pressure at source, it is
required before the anchor can ever be answered correctly, and every downstream connector read in this
phase will hit the same validator. Building the connector first means building on the broken shape.

**Pairs with defect 7** (dataset-grain provenance invisible to the model) — same tool, same change, do them
together.

---

## Current state (verified 2026-07-23)
- **D2 done** (`v0.6.114`); flags dark; Path A retained. **Sandbox is a working smoke** — the founder P&L
  dataset (`founder_dataset_tables.pnl_monthly`) has **one** seed row (June 2026). No financial *series*
  exists today, so real concentration/margin compute is **this phase's** job (CONTEXT.md, 2026-07-16 pin).
- `mcp_connections` = **0 rows** (metadata-only scaffold; secret material in **Supabase Vault**, never in
  the row). `feature_registry` = 19 rows (the gating surface). `tool_registry` = 21 rows (the
  `persistence_semantics` attribute lives here).
- **Q2 RESOLVED (2026-07-15, London):** for the pilot, gate connector availability via `feature_registry`
  (`beta_unlock_week`) + minimal connector config in code + `mcp_connections`. **No `connectors` table**
  until connector #2.

## Deliverable
Two coupled outcomes:
1. **Live connector, end-to-end:** per-user OAuth via `mcp_connections` + Vault, the SDK `mcp_servers`
   config compiled from the registry (Phase C), and a **read-only, ephemeral, cited** QuickBooks P&L pull
   through a bounded worker — chosen by the freshness/authority policy — with the data-lifecycle principle
   enforced and write/privileged blocked at the runtime.
2. **Real sandbox compute:** a stored/vectorized financial **series** (client-level revenue + multi-period
   P&L) accumulated via the **deliberate point-in-time snapshot** exception, so the sandbox performs
   **real** concentration/margin computation — closing the D2 smoke and making the G-gate **A1** shape
   numerically real.

## Steps

### A. Connector auth + config (SDK-F1/F2)
1. Register the QuickBooks connector — availability gated via `feature_registry` (`beta_unlock_week`),
   config in code + `mcp_connections` (per resolved Q2; no `connectors` table for the pilot). Per-user
   OAuth stored as a **`vault_secret_id` reference** in `mcp_connections` — **never** the token in the row.
2. Compile the connector into the founder's SDK `mcp_servers` from the registry (Phase C compiler),
   filtered to founders with an active connection.

### B. Read-only cited pull through a bounded worker (SDK-F3/F4)
1. A bounded worker pulls the live P&L via the MCP tool and returns a **compact, cited** finding
   (provenance: source + as-of timestamp). The **freshness/authority policy** decides live-vs-wiki.
2. Curate the QuickBooks MCP tool descriptions to the ACI standard (Phase C).

### C. Data lifecycle + guardrails (SDK-F5/F6)
1. Enforce **ephemeral**: the raw pull lives in the turn/sandbox scratch; **no** raw copy into Supabase.
   Persistence only via a deliberate `persist_artifact` action.
2. `persistence_semantics` = `read_only` **auto-approves**; **write/privileged** confirm + quarantine,
   **blocked at the runtime** (forced-write proof). **Never move money** — any financial action is
   founder-executed.

### D. Financial-series store + real sandbox compute (the deferred heavy piece)
1. **Series store:** client-level revenue + multi-period P&L, accumulated via the **point-in-time
   snapshot** exception (immutable, `as-of-date`, CONTEXT.md §"Data lifecycle"). Normalization is
   **semantic, not storage** — map "Sales"/"Total Income"/"Revenue" to a canonical concept at reasoning
   time; **do NOT build a universal financial-warehouse schema** (explicit lock). Most likely fed by the
   Step-B MCP retrieval, snapshotted deliberately (the "MCP as an ingestion source / second job"
   distinction) — **not** an automatic byproduct of a pull.
2. **Real compute:** the sandbox worker runs actual concentration (top-N client share) + margin/trend
   computation over the series — replacing the D2 smoke. Validate against the seeded facts (top-5 = 55%
   of MRR, 14 clients, 18% margin) and prove the **A1** shape end-to-end with real numbers.
3. **Vectorization** of the series for retrieval where the compiled-truth-over-timeline (gbrain) page
   shape carries the trend spine.

## Open design tension to resolve WITH London before F-D build (do not silently decide)
The 2026-07-16 pin puts financial-series real compute **in Phase F**, but the data-lifecycle lock says
**"normalization is semantic, not storage — do not build a universal financial warehouse schema."** A
stored/vectorized *series* and "no warehouse schema" are in productive tension. **Resolve the series
store's exact shape with London first** — candidate: extend `founder_dataset_*` (already period-grained:
`period_start`/`period_end`/`period_grain`/`entity_name`/`values`) with immutable as-of snapshots, rather
than a new normalized warehouse. Also confirm the boundary vs. the **pinned-later** general
MCP-snapshot-into-wiki ingestion pipeline (CONTEXT.md: "Not in initial scope") — F-D is the **founder's
own financial series via deliberate snapshot**, not the general product auto-snapshot ingestion.

## Key files
```
python-backend/services/
  vcso_sdk_config.py        SDK mcp_servers compile from registry; per-founder options
  vcso_worker_mcp.py        bounded worker (the read-only cited pull runs here)
  sub_agent_orchestrator.py sandbox_execution_agent (real compute lands here)
  tool_registry.py          persistence_semantics attribute + tier→model
Supabase (pwacpjqkntnovndhspxt): mcp_connections (+ Vault ref), feature_registry, tool_registry,
  founder_dataset_tables/columns/rows (series candidate home), agent_delegation_runs/steps, ai_usage_log
Railway: MCP_TOOL_TIMEOUT=240000 (do not lose — the ~113s sandbox worker needs it)
```

## Acceptance criteria (Process Rule 10 — N consecutive, not one green)
1. Live QuickBooks P&L pull succeeds, **read-only**, founder-scoped, cited (source + as-of).
2. Secret stored as a **vault reference**; never in a row or trace.
3. Freshness policy chose the live source; the pull flowed through a bounded worker with a compact cited
   finding.
4. Raw data ephemeral (no Supabase copy); write/privileged blocked (forced-write proof).
5. **Financial-series store exists** (shape approved by London); the **sandbox performs real
   concentration/margin compute** over it; the **A1** shape proven with real numbers, cited.
6. Traces paired to `ai_usage_log`; founder isolation intact; Path A intact; flags re-darkened, read off.
7. `compileall` clean; frontend green; `ROADMAP.md`/`STATE.md` + `04B-F-COMPLETION.md` updated.
   STOP-and-review read-back to London.

## Locks to preserve
Ephemeral-by-default; persist only synthesis/deliverables as citeable artifacts; deliberate snapshot is
the only persistence path; **never move money**; one-writer (feed OS Engine, never write the wiki);
founder isolation; bounded non-recursive workers; Claude-lock (Sonnet compose / Haiku workers via MA-06);
no founder-facing model selector; curated transparency. **INFRA:** keep `MCP_TOOL_TIMEOUT=240000`;
single-process only; do not re-add the per-agent `timeout` key. Version-tags forward (PATCH default).

## Out of scope
The **general** MCP-snapshot-into-wiki ingestion pipeline for arbitrary connectors (pinned later in
`CONTEXT.md`); additional connectors (Asana / Monday / GHL — post-pilot); generalization + cutover (G).
