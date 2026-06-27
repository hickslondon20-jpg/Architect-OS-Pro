# Domain Agents Wireframe Build

## Built

- Added the Domain Agents area under `/pro/intelligence/domain-agents`.
- Added routes for Agent Gallery, Agent Profile, Agent Workspace, Tasks/Kanban, and Artifacts Library.
- Added a Settings-owned AI Usage stub at `/settings/ai-usage`.
- Added local mock objects for agents, workflows, tasks, artifacts, and request capture.
- Wired Gallery -> Profile -> Workspace, Kanban card -> Workspace, and Artifacts -> originating task.
- Represented all five task states: Ready, Running, Review, Blocked, Done.

## Decisions Applied

- Free-form asks are local-only request capture entries.
- Second Brain promotion is deliberate via button.
- AI Usage lives in Settings; Domain Agents only links to it.
- Every workflow moves through Review in this wireframe.
- Workspace artifact preview is a fixed right rail for now, with code structured so it can become a drawer later.

## Deviations / Notes

- The approved HTML mockup was translated into React components and routes rather than embedded.
- No Supabase, n8n, file upload, storage, or AI calls were added.
- Skills and templates remain hidden from founder-facing UI.
- Domain Agents is gated with the existing `pro_suite` gate for this scaffold rather than a new feature key.
