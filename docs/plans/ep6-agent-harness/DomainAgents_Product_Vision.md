# Domain Agents — Mini Product Vision

**Platform:** ArchitectOS Pro Suite
**Area:** Domain Agents (third intelligence layer)
**Version:** 0.1 — Working Vision (pre-wireframe)
**Date:** June 25, 2026
**Status:** Aligned vision; companion to `DomainAgents_Wireframe_Spec.md`
**Related:** `VirtualCSO_Build_Spec.md`, `OSEngine_Build_Spec.md`, `ArchitectOS_ProSuite_Insight_Map.md`

---

## 1. Purpose of this document

This document defines *what* the Domain Agents area of ArchitectOS Pro is, who it's for, and how a founder is meant to experience it. It is the vision layer. The page-by-page build skeleton lives in the companion wireframe spec.

It is intentionally a "mini" vision — scoped to this one area of the platform — and it is held loosely where it should be. The intelligence model is locked; the specific skills, workflows, and templates we ship are expected to evolve through the beta.

---

## 2. The one-line vision

> Domain Agents are a team of specialist strategic operators a founder can walk into to *get work produced* — analyses, reviews, memos, audits — each one an expert in a single discipline, equipped with the founder's own business context, and able to turn that expertise into a finished, downloadable artifact.

---

## 3. Where Domain Agents sit — the three-peer model

The ArchitectOS Pro intelligence layer has three peers. They are not the same product with different skins; they are three organs of one brain with clean, separate responsibilities.

**OS Engine — memory.** *"What do we know?"* It ingests uploads and platform activity, synthesizes them into durable knowledge, and remembers. Founders feed it; they don't work in it. It is largely invisible.

**Virtual CSO — reasoning.** *"Given everything we know, what should we do next?"* This is open-ended strategic conversation: pressure-testing, brainstorming, decision support. It is also the orchestrator — it can reach over and pull a Domain Agent into a conversation when one is needed.

**Domain Agents — expertise + execution.** *"What can we do with what we know?"* This is where a founder goes deliberately, to produce an outcome. It is outcome-oriented, not conversational. You don't come here to think out loud; you come here to get the monthly review built, the client portfolio analyzed, the team health read produced.

The governing constraint that protects this separation: **we are not building a second Virtual CSO.** Interaction inside a Domain Agent is scoped and task-bound. Open-ended strategy stays in Virtual CSO.

---

## 4. What a Domain Agent is

A Domain Agent is a **professional discipline**, not a feature area. It is the financial discipline that knows how to interpret any financial evidence placed in front of it; the client-and-market discipline that understands acquisition, retention, concentration, and positioning; and so on.

Modeled after the Hermes-style agent pattern, each agent is equipped with:

- **Knowledge** — your IP, frameworks, benchmarks, and the founder's own accumulated context drawn from OS Engine.
- **Capabilities** — the user-facing groupings of what it can do (Analyze / Create / Plan).
- **Workflows** — the packaged, clickable things it can produce.
- **The ability to generate artifacts** — the finished deliverable, which is the one thing Virtual CSO deliberately does *not* do.

The agent is the *curator* of intelligence: when a founder enters it, it assembles a specialized workspace — the right knowledge, the right context, the right tools — for that discipline.

---

## 5. The five domains

The five mirror the dimensions already established across the AE Ladder and the Maturity & Readiness Audit, so the intelligence layer inherits the same spine as the diagnostics.

| Domain | The discipline it owns |
|---|---|
| **Financial** | Interprets any financial evidence — P&L, balance sheet, cash flow, budget, forecast. Margin, revenue quality, growth economics, scenario thinking. |
| **Client** | Client **and market**. Acquisition, retention, concentration, profitability, positioning, portfolio quality. Absorbs the commercial/sales view (CRM, pipeline, win rate, sales velocity). |
| **Operational** | Process, capacity, delivery, workflow, execution, utilization, SOP maturity. |
| **Team** | Organizational design, leadership, delegation, accountability, capability. |
| **Stewardship** | The founder's own role — decision patterns, leverage, strategic focus, and evolution. Also the natural orchestrator of cross-domain decisions. |

**Pricing** is a deliberate cross-domain input: pricing economics (margin impact) is Financial; pricing strategy (positioning, willingness to pay) is Client. It's the first real test of how agents consult one another.

---

## 6. The production model

Everything a Domain Agent does is built from a clean, layered set of objects.

- **Skill** — one atomic analytical operation (*analyze a P&L*, *evaluate client concentration*, *run a team-health analysis*). A reusable primitive. The same high-value skill recombines across many workflows.
- **Workflow** — an ordered chain of skills that produces a synthesis (*Monthly Business Review*, *Pricing Audit*, *Client Segmentation Analysis*). This is the **user-facing package** — surfaced in plain language with a short description. The founder sees the package; the skills underneath stay backstage.
- **Template** — the codified output contract: the rules for how a given deliverable is structured, voiced, and sized. **Internal only.** Founders never browse templates.
- **Artifact** — the finished file. Logged with its storage location, renderable, downloadable, and visible to the founder in the artifacts library.

Two clean instance relationships govern the system:

- **Workflow → Tasks.** A workflow is the definition; a *task* is every run of it. The same "Monthly P&L Assessment" workflow runs as one task on April–May and a separate task on May–June.
- **Template → Artifacts.** A template is the rule; an *artifact* is every output produced from it.

A task produces one or more artifacts. That lineage — agent → workflow → task → artifact — is tracked end to end, which is what makes the artifacts library auditable rather than a file dump.

---

## 7. The experience philosophy

**It's a destination for outcomes.** The front door is "pick an agent → pick what you want produced → get the artifact," not a blank chat box. Entering an agent shows the founder what it's good at and what it can produce.

**It's scoped, not a second CSO.** When a workflow runs, it opens a real workspace — a working chat area where the agent narrates its plan, asks clarifying questions, and gathers the resources it needs. The founder can interact with it and ask about what it produced. But it stays bound to the task. It is not a brainstorming surface.

**The founder still decides.** Like the rest of the platform, the agents surface analysis, patterns, and finished thinking. They make the founder sharper going into a decision; they don't make the decision.

**It compounds.** When a task finishes, its synthesis and artifact can be promoted back into the second brain, so the next conversation — anywhere in the platform — is richer for it. Domain Agents consume from OS Engine and feed back into it.

---

## 8. The founder journey (happy path)

1. The founder enters **Domain Agents** and sees the five agents.
2. They pick the **Financial Agent** and read its profile — what it does, and its thought starters.
3. They click the **Monthly P&L Assessment** workflow.
4. A **workspace** opens and a **task** is created. The agent explains what it will do and what it needs.
5. It checks **OS Engine** for the founder's recent P&Ls; not finding them, it **prompts** the founder to upload them.
6. The founder attaches the files. The agent runs its skills, narrating progress; the **artifact renders** in a side panel as it's built.
7. The task completes. The artifact lands in the **artifacts library** — downloadable, and one click from being **promoted to the second brain**.
8. Throughout, the job has been a card moving across the **Kanban**, so the founder always knows where it stands.

---

## 9. Boundaries — what this is not

- It is **not** a second Virtual CSO. No open-ended strategy chat lives here.
- It does **not** make decisions for the founder.
- It does **not** expose its internal machinery — founders never see skills or templates, only workflows and artifacts.
- In its first form it does **not** connect to live external systems (no QuickBooks, CRM, or PM integrations). Agents reason over uploaded and platform-held context. The disciplines stay constant; only the richness of the evidence grows over time.

---

## 10. Roadmap posture

We start narrow — a small set of skills, a handful of workflows, and a few artifact templates, ideally one anchor workflow per domain — and expand through the beta. The architecture is built so that adding skills, recombining them into new workflows, and adding artifact templates never requires changing the underlying model.

Critically, the **free-form ask** is also a roadmap instrument. When a founder requests something no workflow yet covers, the agent reasons about what it can assemble — and the platform **captures that request**. The accumulating log of out-of-scope asks becomes a direct, evidence-based input into what skills, workflows, and templates we build next.
