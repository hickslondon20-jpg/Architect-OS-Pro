# Episode 5 — Re-Alignment / Context Layer (read before continuing)

**Purpose of this message.** Keep everything you already understand about the Episode 5
reference PRD — it's correct and we are not discarding it. Pause the onboarding for a moment.
This message layers the context you're missing *on top* of your current understanding: how
Episode 5 maps onto **our** platform, and where the reference framing needs correcting so we
build for our use case instead of reverse-engineering the reference series.

---

## First, do this

Before you respond, read these two canonical docs in the repo. They are the source of truth
for how our platform is organized. (The older `.planning/INTELLIGENCE-VISION.md` is
**superseded** — do not rely on it.)

1. **`.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`** — the three surfaces, the four-tier
   knowledge layer, the two-layer wiki, and the write-ownership model.
2. **`.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md`** — the five primitives, their maturation
   across episodes, and the per-episode mapping. Your primary reference is **Section 4 →
   Episode 5**, plus the decision tables (§5 locked, §6 deferred) and the capability-layer +
   MCP notes (§3.1) and usage-metering note (§3.4).

---

## The 60-second grounding (full detail in the docs)

- **Three surfaces, one shared substrate.** **OS Engine writes** (ingestion + the *sole*
  writer of the wiki/knowledge base). **Virtual CSO reads** (the conversational surface).
  **Domain Agents produce** (artifacts and workflows). All three consume the same knowledge
  layer; only OS Engine writes to it — the other surfaces feed it via workflows.
- **Four tiers, progressive escalation.** Tier 0 platform records → Tier 1 compiled wiki
  (Layer 1 fixed orientation pages + Layer 2 emergent, compounding pages) → Tier 2 vector
  search → Tier 3 raw documents. An interaction climbs only as far as it needs.
- **Five primitives we track across episodes:** tools, sub-agents, skills, artifacts,
  workflows.

---

## How Episode 5 reframes for us

The reference frames Episode 5 as "make tool-calling dynamic + add MCP." **For us, Episode 5
is the episode where the capability layer becomes the shared, discoverable substrate beneath
all three surfaces** — the thing that makes the skills-and-plugins area a real, extensible
layer rather than a static list. Correct your framing wherever it currently treats Episode 5
as a Virtual-CSO / chat-only feature.

### Key corrections to likely drift

- The **unified tool registry is not a chat feature.** It's the shared capability layer that
  every surface pulls a *scoped subset* from.
- **Skills become registry citizens** here — the Episode 4 skills fold into the registry as
  deferred-loaded sources, not a separate skills-only mechanism.
- The **sandbox bridge is shared**: Virtual CSO uses it to write code that answers/fetches
  mid-chat; Domain Agents use it to pull live data into artifact generation. It is also the
  founder-data security boundary (credentials host-side, sandbox sees only results).
- **MCP = backend scaffold for MVP/beta, surfaced as "coming soon," no public external
  connections shipped at beta.** Do not scope live GHL/Notion/CRM connections into the beta
  build. (See §3.1 of the map for the MCP + credentials model, including Supabase Vault for
  encrypted credential storage.)

---

## Decisions to honor

**Locked (§5):**
- Skills are **not domain-scoped** (soft tags only).
- The code sandbox is **shared** by Domain Agents and Virtual CSO.
- MCP is **backend-scaffold-only at beta**, no public connections.
- Tool/registry results must be **citation-ready** (Episode 7 depends on it — carry source
  identity + verbatim text; don't return opaque strings).
- The registry must be **surface-aware and context-aware** (Episode 6's harness pulls
  curated per-phase subsets — build for scoped subsetting, not one flat global list).

**Directional / deferred (§6):**
- Whether the Episode 1 / M8 `agent_capabilities` registry and the Episode 5 tool registry
  **unify into one registry or stay two distinct layers** — current lean is **two layers**,
  but the **definitive call is deferred to this episode's build-planning.** Hold it as an
  open design fork: don't force a decision now, but design so either outcome stays reachable.

**Cross-cutting roadmap item (§3.4):** AI usage metering/visibility. Build the Episode 5
context indicator toward a **percentage-of-allotment** signal (per-thread "% remaining before
degradation" + account-level weekly/rolling-window), paired with context compaction. Meter
the intelligence layers only; foundational tools are absorbed. The metering backend, tier
economics, and admin panel are flagged-for-later, not scoped now.

---

## Your task (reframed)

You are **not implementing yet**, and you are **not re-deriving the PRD**. Produce a
**brainstorm + incremental rollout plan** for Episode 5 across the three surfaces:

1. For each Episode 5 capability — unified tool registry + `tool_search`, sandbox HTTP bridge,
   MCP client scaffold, context/usage indicator, interleaved history rendering — map **which
   surface(s) it serves** and **what it enables for our use case.**
2. Sequence the **incremental steps** to roll it out, calling out dependencies and the
   **build-it-right seams** (from the Episode 5 section of the map) so nothing forecloses
   Episode 6 or 7.
3. Surface **what still needs brainstorming vs. what's decided**, and flag any conflicts with
   the locked decisions rather than resolving them silently.
4. We will use the **GSD flow** for the actual phase plans. This pass produces the aligned
   working model and step sequence that feeds GSD — not the implementation itself.

## How to work

- Map to **our use case**; do not reverse-engineer the reference series.
- **Flag drift or conflicts** rather than resolving them silently.
- **Respect the deferred decisions** — especially the registry reconciliation.
- Go **one surface / capability at a time** and confirm alignment before moving on.
