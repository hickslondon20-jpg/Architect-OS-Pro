# Handoff Prompt — #01: Relocate 3P into Sprint Planning

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`). You have full codebase access and will execute one scoped, incremental task. I am the orchestration agent; you are the implementer. Stay strictly within the scope below — do not expand it, and when a structural decision is ambiguous, flag it and ask rather than improvising.

**Read first, in order:**
1. `docs/sprint-planning-flow-spec.md` — the canonical, soft-locked flow for the whole Planning & Strategy step-down. This is the "why."
2. `docs/handoffs/01-relocate-3p-task-spec.md` — the exact task, in-scope/out-of-scope lists, file references, and acceptance criteria. This is the "what."

**Your task in one sentence:** Non-destructively relocate the existing Supabase-wired 3P prioritization exercise into the Sprint Planning sub-section as a sequenced step between Sprint Goal and Sprint Board, re-order the Sprint Planning flow to match the canonical sequence, and wire the forward navigation chain — while leaving Quarter Map's copy fully functional.

**Hard guardrails:**
- This is structural only. Do NOT wire the Sprint Board to real data, do NOT consolidate the Sprint Goal wizard, and do NOT demote, retire, or delete anything — including Quarter Map's existing 3P page, which must keep working.
- Do not duplicate the Supabase data-fetch logic into a divergent second file. Reuse it (prefer extracting a shared component; see the task spec).
- Honor the AOS design system (tokens, Geist, no Inter / pure black / neon / glow / text gradients).
- TypeScript must compile clean.

**Before you write code:** verify the current wiring yourself — the route block in `App.tsx` (Sprint Planning, ~lines 185–194), `SprintPlanningLayout.tsx` tabs, `CurrentQuarterFocusTab.tsx` (the 3P engine + its `handleLock`), and the two navigate targets called out in the task spec. Confirm reality matches the spec before changing anything; flag discrepancies.

**When done:** verify against every acceptance criterion in the task spec (build clean + manual click-through of goal → 3P → board → review → synthesis), then report back in the format the task spec specifies — files changed with intent, the reuse approach you chose and why, any layout reconciliation, and anything you flagged rather than decided. Do not mark complete if any acceptance criterion fails or any transition still hits a dead route.
