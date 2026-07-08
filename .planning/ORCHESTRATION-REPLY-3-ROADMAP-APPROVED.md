# Reply to Orchestration Agent — Round 3 (roadmap approved, two adjustments)

*(Paste to the orchestration thread in response to the State → Roadmap to MVP.)*

---

Roadmap approved — it's tight, plain-English, and faithful to everything we settled. Two
adjustments on the sequencing you flagged, one emphasis, then we're clear to start.

## Emphasis — Gate 1 is the discovery-risk crux, not just a priority

Say this out loud in the plan: the wiki has **zero pages today** and the ingestion→compile
pipeline has never run live, so the testing pass isn't "confirm green" — it's **find out whether
the core actually works.** Everything downstream (wiki liveness, wiki-page citations, cross-tier
reasoning, the whole differentiator) rides on that pipeline. Scope the testing pass with **room
to fix what Gate 1 uncovers**, not just verify it. It's the highest-discovery-risk item in the
plan; treat it that way.

## Q1 — UI polish before §8: yes, but scope it narrowly

Keep the order (polish → §8), per the steer. Guardrail: **step 3 is a narrow legibility/
usability cleanup of the already-wired surfaces only** (citation chips/sidecar, Domain Agents,
Deep Mode — the Ep6/Ep7 surfaces that exercise real backend reads). Enough to test, demo, and
iterate. It is **not** a design treatment. §8 owns the comprehensive job: real-wiring the
still-mock surfaces + the full design pass. Reason: you can only polish what's wired to real
data, and if step 3 drifts into design it overlaps §8 and gets redone. Narrow scope prevents
double-work.

## Q2 — Router: build parallel with §8, not after

Change the default from "router after §8" to **"router parallel with §8" (if the evidence point
puts it in MVP).** The reasoning: the router is a **backend** component (tier-selection +
assembly pre-step); §8 is **front-end**. The router's real foundation is **A + the pipeline
being live** — which lands in the testing pass (step 2), *before* §8. So "build on the
fully-wired foundation" conflates §8's front-end wiring with the router's actual (backend)
dependency; the router doesn't need §8 done. Sequencing it after §8 serializes two independent
workstreams for no technical reason.

- If the step-2 evidence point puts the router in MVP → **build it in parallel with §8.** They
  don't collide: the CSO answer/citation/trace contract is locked (L11, L22), so the router
  improving answer quality and §8 polishing the surface stay additive.
- **One coordination point:** keep that answer/citation/trace contract stable so the router's
  backend changes and §8's front-end work don't step on each other. (If the router adds e.g. a
  "tiers consulted" element to the trace, that's a small additive display item, coordinated —
  not a blocker.)
- If we later prefer strict single-workstream focus, serial is fine — but there's still no
  reason to force the router *after* §8 specifically.

Update step 5 in the sequenced path accordingly (router runs alongside §8 when in-MVP), and keep
the in-beta-vs-fast-follow call at the step-2 evidence point as-is.

## Go

With those two adjustments, the roadmap is locked as our alignment artifact. **Green light to
start:** lead with the **MRA quick win** (repoint + guard + CLAUDE.md Rule #3 fix), then scope
the **consolidated testing / verification-debt managing agent** — which carries Gate 1 (pipeline
liveness) as its highest-discovery-risk objective, with OpenAI billing cleared as the
prerequisite. Bring me the managing-agent scope before you spin it up.
