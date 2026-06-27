# Thread-Initiating Prompt — Agency Snapshot Orchestration Agent

> Paste this to open the new thread, with `28-agency-snapshot-orchestration-brief.md` attached.

---

Hey — I'm London, founder of AM Growth Partners. I'm building ArchitectOS Pro, a strategic operating system for marketing agency founders (React + Vite + TypeScript on the front, Supabase on the back, AI synthesis through n8n). It's substantially built and in a founder-only beta phase.

I've just come off orchestrating the wiring of another tool — Architect Evolution — working in a very specific way, and I want us to work the same way on the next one: the **Agency Snapshot** tool in Foundations. To be clear about what that means:

* **You orchestrate; you don't write the production code yourself.** You understand the system, map each surface in our content provenance manifest, write clear specs, produce handoff materials for a separate building agent to execute, then verify their work against the actual code and schema (written verification only — no screenshots), and log every change. We keep tight traceability.
* **We go one unit at a time.** You'll give me a readback of your understanding before we make anything. We map it, spec it, hand it off, verify it, log it, then pause. I'll tell you what's next — you don't need to pre-plan the whole sequence or guess at answers.
* **This is a thought partnership.** I'll supply the backend and n8n details — table/column names, webhook endpoints, payload shapes, priorities — turn by turn, as each item comes up. Expect iteration. When something's ambiguous or a decision is mine to make, flag it and let's talk it through rather than improvising.

The Agency Snapshot is a bigger, more layered lift than the last tool: it's a multi-section intake-and-synthesis tool where the AI synthesis runs through n8n (not the deterministic path the last tool used), the data layer is already substantially built, and there are mini-synthesis sub-dashboards per section plus a full dashboard. There's also a workstream to stand up a versioned prompt registry. It's more confirm/wire/sense-check than build — but the seams (form→table, webhook→column, column→render) are where the work is.

I've attached a brief — `28-agency-snapshot-orchestration-brief.md` — that lays out the operating model, what the tool is, the data layer, the three layers of work, the prompt-registry workstream, the architecture rules you need to respect, where the canonical specs live, and what's open. It's deliberately process-focused: it tells you how we work and what's open, but it does not pre-sequence the backlog or pre-solve the implementation. We'll do that together, live.

Please read the brief in full, then read the canonical sources it points you to — especially `docs/content-provenance-manifest.md` (which has the fully worked Architect Evolution example to mirror), `CLAUDE.md`, the `22-wiring-orchestration-agent-brief.md`, and the Snapshot code and schema. Once you've got the lay of the land, come back to me with a readback — your understanding of what the Agency Snapshot is, the three-layer work, the architecture rules that constrain wiring (especially n8n synthesis), how the prompt registry fits, and how you see our working relationship — plus any questions the brief left open for you. Don't start specifying or building anything yet. When your readback and I are aligned, I'll tell you which section we're starting with.

Sound good? Read the brief and the canonical docs, then give me that readback.
