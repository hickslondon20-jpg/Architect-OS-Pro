# Episode 6 — Planning Feedback (Round 1): green light with four alignments

Strong pass. The backend audit, the reuse-before-create map, the naming-collision catch
(`domain_agents` vs the M8 `agent_capabilities` registry), and — especially — flagging the
free-form answer instead of absorbing it are exactly right. Your resolutions on decision
points 1–5, the conflict handling (OpenAI framing dropped for L12, no thread-coupling of
tasks, `agent_todos` as Deep-Mode-only), and the P0–P8 skeleton are approved as the working
model. Four alignments below, then you're cleared to write plan files.

All four are now codified in `.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md` (Episode 6
Refinement 2, and locked decisions L16–L21) — treat the doc as source of truth.

---

## 1. Free-form ask — go broader than your reconciliation (L16)

Your capability-vs-mode distinction is the right axis, and the answer is the **broad** side of
it. Don't fence agent-to-agent consultation off as a fast-follow — it's **in scope now.**

The predefined workflows are the good **starting points / playbooks** for the most common
artifacts — that's their value — but they are **not a cage.** When a request falls outside a
defined recipe, the agent should reason about it in context, use the skills and tools it has
access to, incorporate the founder's feedback, and construct a logical path to a scoped
artifact — **including consulting another domain agent** where that helps (e.g. the pricing
cross-domain case).

The two lines that still hold (this keeps it from becoming a second CSO):

- **Mode:** it stays artifact/outcome-bound. Not open-ended strategy chat (L14).
- **Capability surface:** it works within its **registered** skills/tools + peer agents. No
  authoring brand-new skills mid-task, no reaching outside the registry.

Every free-form ask still logs to request-capture. Net: real latitude to think and assemble
outside the predefined box, bounded by mode and by the registered capability surface — not by
the menu of predefined workflows.

## 2. Harness ↔ OS Engine — it's the promotion feeder, and it goes in the plan (L17)

Reframe D2: the harness does **not** do wiki synthesis. Same pattern as everywhere else — the
surface *initiates*, OS Engine *synthesizes*. When an artifact is promoted/flagged for
ingestion, that promotion **triggers an OS Engine workflow** that runs it down the pipeline to
produce **both** a **vectorized asset (Tier 2)** and a **wiki page (Tier 1/2 where it makes
sense).** OS Engine does the synthesis as sole writer (architecture §5); the domain agent only
kicks it off.

Build the **trigger/hand-off into the plan** (at the P5 second-brain-promotion step) with the
downstream intent documented — but the full OS Engine wiki-generation implementation is OS
Engine's concern, not an Ep6 deliverable. So this stops being "keep the engine generic and
decide later" and becomes "build the initiation; the downstream is defined."

## 3. P0 verification gate — drop it as a blocker (L18)

The verification debt is real and stays flagged/monitored, but it does **not** gate Ep6.
Strategy is scaffold-first: build the MVP/V1 across these areas, then wire real credentials and
run consolidated smoke testing once there's something live to react to. So the Ep5 sandbox/loop
verification (egress NetworkPolicy, live smokes, Python-stream flip) **folds into the later
consolidated smoke/credentials phase** (episode map §8), not a blocking P0. Don't hold the
build waiting on it; keep it on the radar so it isn't lost.

## 4. Anchor workflow — build it generic as a POC (L19)

A sensible, generic Monthly P&L Assessment step chain is the goal — a **proof of concept** to
prove the engine and the wiring work end to end and show it in practice. Don't source canonical
financial IP now; draft a reasonable chain (prereq → parse → analyze → synthesize →
template→artifact). We refine the analytical content with real IP later. You're validating the
legs, not shipping the final recipe.

---

## Two seams to build in (confirmed, L20–L21)

- **Codify the Rule #4 scoping (L20).** Your call is right — Domain Agent artifacts use the
  Ep4 sandbox export path; CLAUDE.md Rule #4 (N8N + Google-Docs) governs the fixed platform
  reports (MRA, AE Ladder, Sprint Launch Doc) only. Because it touches a hard rule, **write it
  down** (a note in CLAUDE.md and/or the plan), so a future agent reading Rule #4 doesn't flag
  Domain Agent artifacts as a violation.
- **Owner-flexible substrate (L21).** Build the shared substrate — `workspace_files`,
  ask-user, sub-agent delegation, curated trace — keyed to `task_id` **or** `thread_id` from
  the start, so P6 (VCSO Deep Mode) **reuses** it rather than forking a thread-scoped copy.
  This protects the "build the substrate once" principle the phase skeleton could otherwise
  obscure.

---

## The rest of your open items

- **D1** — confirmed resolved by the code (two layers bridged by scope sources). Good.
- **Wireframe §12 opens** — auto-ingest → deliberate ✓, review-gate → always stop at Review
  ✓, free-form guardrails → see #1 above (broader than you proposed).

## Green light

With #1–#4 and L20–L21 folded in, **write the plan files** (P0 becomes a flagged dependency
note rather than a gating phase — renumber as you see fit). Keep planning surface + backend
together, carry provenance through the Task→Artifact lineage for Ep7, and flag any new conflict
with the locked decisions rather than resolving it silently.
