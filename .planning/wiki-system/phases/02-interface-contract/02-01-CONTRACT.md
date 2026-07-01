# ArchitectOS Wiki Interface Contract

contract_version: wiki-1.0
status: frozen for sub-phases 03-05 and 07

This contract is the stable surface for the ArchitectOS Wiki System build. It defines the read API,
compiled digest, mutation surface, data shapes, actor scope, orchestrator seams, and conformance
guarantees. It intentionally does not define storage layout, file layout, CLI commands, or reference
repo substrate.

## Actor Classes

- compilation service: the single internal writer for compiled-base claims and digest generation.
- domain agent: bounded runtime agent allowed to read wiki context and propose quarantined insight.
- founder: authenticated founder-facing actor allowed to confirm overrides and promotions.
- orchestrator-read: the existing sub-agent orchestrator read path for registered read capabilities.

## Data Shapes

### claim

Signature:

```text
claim {
  id: string,
  page_key: string,
  text: string,
  class: "compiled" | "insight" | "override",
  status: string,
  confidence: "high" | "medium" | "low",
  recall_score: number,
  evidence: evidence[],
  contradictions: object[],
  updated_at: string
}
```

Rules:

- `claim` is single-sourced: the compiler writes compiled claims, agents read claims.
- `confidence` is the founder/agent-facing display enum. `recall_score` is the hidden machine score.
  They are always separate.
- `class` determines precedence and trust handling.
- `contradictions[]` records contested relationships without deleting either claim.

Invariant upheld: knowledge is claim-level, provenance-bearing, and never collapsed into untracked
page prose.

### evidence

Signature:

```text
evidence {
  source_id: string,
  source_kind: "raw_document" | "document_chunk" | "tier0_record" | "global_checkpoint",
  path: string,
  lines: object | null,
  weight: number,
  note: string
}
```

Rules:

- Evidence is carried next to the claim it supports.
- Reads return evidence with the claim.
- There is no page-bottom source list in this contract.

Invariant upheld: claim-level provenance remains inspectable and resolvable to source records.

## Digest Object

Signature:

```text
digest {
  user_id: string,
  wiki_version: string,
  generated_at: string,
  pages: page_digest[],
  top_claims: digest_claim[],
  counts: digest_counts,
  qualifiers: digest_qualifiers
}
```

Fields:

- `user_id`: founder user id for the per-user wiki. Computed from the wiki owner.
- `wiki_version`: version of the compiled wiki snapshot. Computed by the compilation service.
- `generated_at`: digest generation timestamp. Computed when the digest is emitted.
- `pages[]`: one digest entry per canonical wiki page.
- `top_claims[]`: highest-signal claims selected for thin agent context.
- `counts`: aggregate health counters for contradiction, question, confidence, and quarantine state.
- `qualifiers`: compact freshness and confidence qualifiers for the whole wiki.

### page_digest

```text
page_digest {
  page_key: string,
  title: string,
  one_line: string,
  claim_count: number,
  top_claim_ids: string[],
  confidence_rollup: "high" | "medium" | "low",
  last_compiled_at: string,
  stale: boolean
}
```

- `page_key`: canonical page key.
- `title`: founder-facing page title.
- `one_line`: the per-page index entry; this is also the A4 index artifact.
- `claim_count`: count of claims in the effective page set.
- `top_claim_ids`: selected claim ids for cheap follow-up lookups.
- `confidence_rollup`: rollup from claim confidence, contradiction state, and freshness.
- `last_compiled_at`: latest compile timestamp for the page.
- `stale`: true when the page is older than the freshness threshold defined by the compiler.

### digest_claim

```text
digest_claim {
  claim_id: string,
  page_key: string,
  text: string,
  confidence: "high" | "medium" | "low"
}
```

- Selected from trusted compiled/override claims and high-signal quarantined insight when useful for
  reasoning context.
- Claim-id to page lookup is satisfied by `wiki_get_claim(claim_id)` returning `page_key`.

### digest_counts

```text
counts {
  contradictions: number,
  open_questions: number,
  low_confidence: number,
  quarantined: number
}
```

- `contradictions`: count of open contradiction links.
- `open_questions`: count of unresolved question/tension claims.
- `low_confidence`: count of claims with display confidence `low`.
- `quarantined`: count of insight claims not yet promoted.

### digest_qualifiers

```text
qualifiers {
  overall_confidence: "high" | "medium" | "low",
  oldest_page_age: string
}
```

- `overall_confidence`: aggregate display qualifier from page rollups and health counters.
- `oldest_page_age`: age of the oldest compiled page, expressed by the compiler as a compact string.

Invariant upheld: agents can prime context from a small, high-signal object instead of scraping pages.

## Read Operations

All read operations return `agent_result_v1`-shaped results with first-class citations.

### wiki_get_page

Signature:

```text
wiki_get_page(user_id: string, page_key: string) -> agent_result_v1
```

Args:

- `user_id`: founder user id.
- `page_key`: canonical wiki page key.

Return shape:

```text
{
  schema_version: "agent_result_v1",
  summary: string,
  findings: [{
    type: "wiki_page",
    page_key: string,
    claims: claim[],
    precedence: "override > compiled > insight"
  }],
  confidence: number,
  needs_review: boolean,
  reasoning_visibility: "summary_only",
  source_count: number
}
```

Error modes:

- `not_found`: page key does not resolve for the user.
- `unauthorized`: caller cannot read the user wiki.
- `invalid_page_key`: page key is malformed or not canonical.

Actor scope: domain agent, orchestrator-read.

Invariant upheld: returns the effective page with precedence pre-applied while leaving each claim's
`class` and `trust` visible so quarantined insight is reasoning-only.

### wiki_get_claim

Signature:

```text
wiki_get_claim(user_id: string, claim_id: string) -> agent_result_v1
```

Args:

- `user_id`: founder user id.
- `claim_id`: wiki claim id.

Return shape: one `claim` with full `evidence[]` and contradiction metadata inside an
`agent_result_v1` finding of type `wiki_claim`.

Error modes:

- `not_found`: claim id does not resolve for the user.
- `unauthorized`: caller cannot read the claim.
- `invalid_claim_id`: claim id is malformed.

Actor scope: domain agent, orchestrator-read.

Invariant upheld: claim lookup is the only claim-id to page lookup surface and always returns
claim-level provenance.

### wiki_search

Signature:

```text
wiki_search(user_id: string, query: string, page_key?: string) -> agent_result_v1
```

Args:

- `user_id`: founder user id.
- `query`: semantic query.
- `page_key`: optional page scope.

Return shape: ranked `wiki_claim` and/or `wiki_page` findings with citations and ranking metadata.

Error modes:

- `invalid_query`: empty or unsafe query.
- `invalid_page_key`: optional page scope is malformed or not canonical.
- `unauthorized`: caller cannot read the user wiki.

Actor scope: domain agent, orchestrator-read.

Invariant upheld: searches compiled plus insight layers; contested and stale state influence ranking
without converting quarantined insight into assertable truth.

### wiki_search_insight

Signature:

```text
wiki_search_insight(user_id: string, query: string, page_key?: string) -> agent_result_v1
```

Args:

- `user_id`: founder user id.
- `query`: semantic query.
- `page_key`: optional page scope.

Return shape: ranked insight-layer findings only, each exposing trust/quarantine state.

Error modes:

- `invalid_query`: empty or unsafe query.
- `invalid_page_key`: optional page scope is malformed or not canonical.
- `unauthorized`: caller cannot read the user wiki.

Actor scope: domain agent, orchestrator-read.

Invariant upheld: insight retrieval is explicitly scoped to reasoning-only material until founder
promotion.

### wiki_read_digest

Signature:

```text
wiki_read_digest(user_id: string) -> agent_result_v1
```

Args:

- `user_id`: founder user id.

Return shape: the `digest` object inside an `agent_result_v1` finding of type `wiki_digest`.

Error modes:

- `not_found`: no digest exists for the user wiki.
- `stale_digest`: digest exists but is marked stale by the compiler.
- `unauthorized`: caller cannot read the user wiki.

Actor scope: domain agent, orchestrator-read.

Invariant upheld: thin context priming uses the compiled digest rather than ad hoc page scraping.

### global_ip_get

Signature:

```text
global_ip_get(selector: { domain?: string, stage?: string, tier?: string, topic?: string }) -> agent_result_v1
```

Args:

- `domain`: optional IP domain selector.
- `stage`: optional AE/GM stage selector.
- `tier`: optional tier selector.
- `topic`: optional topic selector.

Return shape: global IP page findings and `global_checkpoint` citations for authored IP pages and
the GM checkpoint family.

Error modes:

- `invalid_selector`: no supported selector is present or selector values conflict.
- `not_found`: no global IP or checkpoint rows match the selector.
- `unauthorized`: caller is not the service-role read path.

Actor scope: orchestrator-read through service-role only.

Invariant upheld: global IP is founder-invisible and read through a deterministic service-role path.

## Write Operations

Write operations are mutation endpoints, not retrieval-capability tools. They belong to FastAPI
service methods and the existing write-back bridge. The registered retrieval capabilities do not
list these tools.

### propose_insight_claim

Signature:

```text
propose_insight_claim(
  user_id: string,
  page_key: string,
  text: string,
  evidence: evidence[],
  confidence: "high" | "medium" | "low"
) -> { insight_id: string, status: "quarantined" }
```

Error modes:

- `invalid_page_key`: page key is malformed or not canonical.
- `invalid_evidence`: evidence is missing or not resolvable.
- `below_confidence_bar`: proposed confidence is below the write-back gate.
- `unauthorized`: caller is not a domain agent write-back path.

Actor scope: domain agent only.

Invariant upheld: proposed agent insight is append-only, quarantined, and reasoning-only until
promoted.

### set_claim_confidence

Signature:

```text
set_claim_confidence(
  user_id: string,
  claim_id: string,
  confidence: "high" | "medium" | "low"
) -> { claim_id: string, confidence: "high" | "medium" | "low", updated_at: string }
```

Error modes:

- `not_found`: claim id does not resolve for the user.
- `invalid_confidence`: confidence is not `high`, `medium`, or `low`.
- `unauthorized`: caller is not allowed to adjust confidence for this claim class.

Actor scope: compilation service for compiled claims; founder for overrides and reviewed insight.

Invariant upheld: display confidence can be corrected without changing `recall_score` or claim text.

### flag_contradiction

Signature:

```text
flag_contradiction(
  user_id: string,
  claim_id: string,
  against_claim_id?: string,
  page_ref?: string,
  note: string
) -> { contradiction_id: string, status: "open" }
```

Error modes:

- `not_found`: primary claim or referenced claim/page does not resolve.
- `invalid_target`: neither `against_claim_id` nor `page_ref` is provided.
- `unauthorized`: caller cannot flag contradictions for the user wiki.

Actor scope: compilation service, domain agent, founder.

Invariant upheld: contradictions are tracked as explicit contested state and do not silently rewrite
or delete claims.

### add_override

Signature:

```text
add_override(
  user_id: string,
  page_key: string,
  claim_id?: string,
  text: string
) -> { override_id: string, class: "override", precedence: "highest" }
```

Error modes:

- `invalid_page_key`: page key is malformed or not canonical.
- `not_found`: optional claim id does not resolve for the user.
- `unauthorized`: caller is not the founder.

Actor scope: founder only.

Invariant upheld: overrides are founder-authored and take highest precedence.

### promote_insight

Signature:

```text
promote_insight(user_id: string, insight_id: string) -> { insight_id: string, trust: "trusted" }
```

Error modes:

- `not_found`: insight id does not resolve for the user.
- `not_quarantined`: insight is not in a promotable quarantined state.
- `unauthorized`: caller is not the founder confirmation path.

Actor scope: founder only.

Invariant upheld: founder confirmation is the only quarantined-to-trusted path, and the action is
auditable.

### demote_insight

Signature:

```text
demote_insight(user_id: string, insight_id: string) -> { insight_id: string, trust: "quarantined" }
```

Error modes:

- `not_found`: insight id does not resolve for the user.
- `not_trusted`: insight is not in a demotable trusted state.
- `unauthorized`: caller is not the founder confirmation path.

Actor scope: founder only.

Invariant upheld: promotion is reversible through the action log without deleting the original
insight.

Hard exclusion: there is no `write_compiled_claim` mutation. Compiled base is written only by the
internal compilation service path that emits `class="compiled"`.

## Orchestrator Seams

These names and signatures are stable surfaces for sub-phases 03-05. Sub-phase 02 only registers
capabilities and returns not-implemented handler stubs.

### start_run dispatch

Signature:

```text
SubAgentOrchestrator.start_run(request: SubAgentRunRequest) -> SubAgentRunResult
SubAgentOrchestrator._handle_per_user_wiki(context: AgentContextBundle) -> dict[str, Any]
SubAgentOrchestrator._handle_global_ip(context: AgentContextBundle) -> dict[str, Any]
```

Scope: extend the existing dispatch branches in place while keeping the current service and current
handlers.

### AgentContextBuilder scope and loaders

Signature:

```text
AgentContextBuilder.build(
  user_id: string,
  parent_surface: string,
  task_summary: string,
  context_scope: dict,
  capability: AgentCapability
) -> AgentContextBundle
```

Stable scope keys to add in later sub-phases:

- `page_keys: string[]`
- `claim_ids: string[]`
- `global_ip_selector: { domain?: string, stage?: string, tier?: string, topic?: string }`
- `checkpoint_selector: { capability_id?: string, stage_id?: string }`

Loader signatures to add in later sub-phases:

```text
_load_wiki_pages(user_id: string, page_keys: string[], allowed_source_kinds: set[str]) -> list[dict]
_load_wiki_claims(user_id: string, claim_ids: string[], allowed_source_kinds: set[str]) -> list[dict]
_load_global_ip(selector: dict, allowed_source_kinds: set[str]) -> list[dict]
_load_global_checkpoints(selector: dict, allowed_source_kinds: set[str]) -> list[dict]
```

### Deterministic GM/global-IP read service

Decision: add a separate deterministic read service for GM checkpoint and global-IP reads rather than
expanding the structured dataset query allow-list for this surface.

Signature:

```text
GlobalIpReadService.get(selector: dict) -> agent_result_v1
GlobalIpReadService.get_checkpoints(selector: dict) -> agent_result_v1
```

Scope: read-only, service-role only, founder-invisible.

### allowed_source_kinds

Add these source kinds for registry rows and source refs:

```text
wiki_page
wiki_claim
wiki_evidence
wiki_digest
global_ip_page
global_checkpoint
```

## Capability Registry Rows

### per_user_wiki

```text
capability_key: "per_user_wiki"
label: "Per-user wiki"
allowed_surfaces: ["virtual_cso", "os_engine", "domain_agent", "sprint_planning"]
allowed_tools: ["wiki_get_page", "wiki_get_claim", "wiki_search", "wiki_search_insight", "wiki_read_digest"]
allowed_source_kinds: ["wiki_page", "wiki_claim", "wiki_evidence", "wiki_digest"]
output_schema: { version: "agent_result_v1" }
can_spawn_agents: false
```

### global_ip

```text
capability_key: "global_ip"
label: "ArchitectOS global IP"
allowed_surfaces: ["virtual_cso", "domain_agent", "system"]
allowed_tools: ["global_ip_get"]
allowed_source_kinds: ["global_ip_page", "global_checkpoint"]
output_schema: { version: "agent_result_v1" }
can_spawn_agents: false
```

## Hard Guarantees

- Compiled base is **write-locked to the compilation service** (L2). No `write_compiled_claim` exists
  in the agent-facing surface; only the internal `compile_page` (04) emits `class='compiled'`.
- Insight layer is **append-only + quarantined**; **reasoning-only until promoted** (D9) — reads
  expose `trust: quarantined` but the surface marks it non-assertable.
- Override layer is **founder-only**, highest precedence.
- Promotion is the **only** quarantined→trusted path; **founder-confirmation** in beta; every
  promotion is **auditable + reversible** via the action-log (A4/B4).
- Read precedence: **override > compiled > insight**.
