# Phase 9 — EXECUTION AGENT PROMPT
# Retrieval Router + Chat Experience

**You are a focused execution agent for ArchitectOS Pro.** Your job is to implement Phase 9 of the Knowledge Base Explorer project exactly as specified below. Read this file in full before writing a single line of code.

---

## Context You Must Have Before Starting

**What was already built:**
- Phases 1–8 of the KB Explorer are complete. The Python backend at Railway exposes `/api/agent-runs` with `capability_key: "kb_explorer_agent"`. This capability navigates the founder's uploaded document library using ls, tree, grep, glob, and read tools.
- Phase 8 mirrored compiled wiki pages (Layer 1) into `ose_knowledge_pages` and expanded `CORE_PAGE_KEYS` in `chat.ts`.
- The Virtual CSO streams via `api/vcso/chat.ts` (Vercel serverless) → Claude Sonnet → SSE to browser.

**What is missing (what you are building):**
- The Virtual CSO has no routing logic to call the KB Explorer. It ignores uploaded documents entirely.
- The chat UI wraps assistant messages in a visible bubble container that should be removed.
- There is no display for sub-agent tool steps in the chat.

**Platform rules (non-negotiable):**
- All AI synthesis goes through N8N webhooks OR the Virtual CSO Vercel function — never new direct client-side Anthropic calls.
- The `openai` npm package is dead code — do not import it.
- No Supabase Edge Functions for AI.
- Beta is founder-only — no team account flows.

---

## Step 0 — Mandatory Pre-Read (Before Writing Any Code)

Read these files to verify the current state matches the RESEARCH.md facts:

1. `python-backend/services/sub_agent_orchestrator.py` — read lines 1–120 to confirm the exact shape of each entry in the `trace` list returned in `AgentRunResponse`. You need this to write the `AgentStep` interface accurately.
2. `api/vcso/writeback.ts` — lines 70–85 to confirm the env var names (`ARCHITECTOS_PYTHON_BACKEND_URL`, `ARCHITECTOS_INGEST_SECRET`) and the header name (`x-ingest-secret`).
3. `components/pro-suite/virtual-cso/VirtualCSOWorkspace.tsx` — skim to confirm there is no existing `agentSteps` handling or `AgentStepsPanel` import.

Do not proceed to Task 9A until you have read those three files.

---

## Task 9A — Retrieval Router in `api/vcso/chat.ts`

**File:** `api/vcso/chat.ts`

### Step 1 — Add `AgentStep` type

After the `SourcePage` type definition, add:

```ts
type AgentStep = {
  tool: string;
  input: Record<string, unknown>;
  output: string;
};
```

Adjust the `output` field type based on what you confirmed in `sub_agent_orchestrator.py`. The goal is a clean `string` for display. If the trace record stores output as an object, stringify it; document the adaptation.

### Step 2 — Add `shouldCallKbExplorer(text: string): boolean`

Add this function before the `handler` export. It returns `true` if the message text contains any keyword/phrase that signals the founder is asking about an uploaded document.

```ts
const shouldCallKbExplorer = (text: string): boolean => {
  const lower = text.toLowerCase();
  const triggers = [
    'document', 'file', 'pdf', 'uploaded', 'transcript',
    'sop', 'report', 'briefing',
    'find in my', 'search my', 'in my knowledge base',
    'in my files', 'in my documents',
    'what does the', "what's in the", 'according to the', 'per the',
    'summary of', 'read me', 'pull from',
  ];
  return triggers.some((trigger) => lower.includes(trigger));
};
```

### Step 3 — Add `callKbExplorer(...)` with timeout

Add this function:

```ts
const callKbExplorer = async (
  userId: string,
  taskSummary: string,
  threadId: string,
  userMessageId: string,
): Promise<{ resultSummary: string; steps: AgentStep[] } | null> => {
  const backendUrl = process.env.ARCHITECTOS_PYTHON_BACKEND_URL;
  const ingestSecret = process.env.ARCHITECTOS_INGEST_SECRET;
  if (!backendUrl || !ingestSecret) return null;

  const timeoutMs = 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${backendUrl}/api/agent-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ingest-secret': ingestSecret,
      },
      body: JSON.stringify({
        user_id: userId,
        parent_surface: 'virtual_cso',
        capability_key: 'kb_explorer_agent',
        task_summary: taskSummary.slice(0, 4000),
        context_scope: {},
        task_title: null,
        parent_thread_id: threadId,
        parent_message_id: userMessageId,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (data.error_message) return null;

    const steps: AgentStep[] = (data.trace ?? []).map((entry: any) => ({
      tool: String(entry.tool ?? entry.tool_name ?? ''),
      input: entry.input ?? entry.arguments ?? {},
      output: typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output ?? ''),
    }));

    return {
      resultSummary: data.result_summary ?? '',
      steps,
    };
  } catch {
    // Timeout or network error — silent fallthrough
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
```

**Important:** The `entry.tool`, `entry.input`, and `entry.output` field names should match what you confirmed in Step 0. Adjust field names if the actual trace record uses different keys.

### Step 4 — Update `assemblePrompt()` signature and body

Add `kbFindings?: string` to the args object type inside `assemblePrompt`. Then insert a new section between `LINKED FOLDER SCOPE` and `RESPONSE CONTRACT`:

```ts
`KB EXPLORER FINDINGS\n${args.kbFindings ?? 'Not invoked for this message.'}`,
```

The full sections array, after the insertion, should be in this order:
1. `SYSTEM PROMPT`
2. `ACTIVE WS5 DOCTRINE`
3. `CLASSIFICATION PROMPT USED FOR ROUTING CONTRACT`
4. `ROUTING RESULT`
5. `SKILL INDEX METADATA ONLY`
6. `SELECTED SKILL PACKS - SERVER SIDE ONLY`
7. `INVOKED IP PAGES - SERVER SIDE ONLY`
8. `FOUNDER WIKI COMPACT INDEX`
9. `LOADED FOUNDER WIKI PAGES`
10. `PROJECT PINNED CONTEXT`
11. `RECENT THREAD CONTEXT`
12. `LINKED FOLDER SCOPE`
13. **`KB EXPLORER FINDINGS`** ← new
14. `RESPONSE CONTRACT`
15. `FOUNDER MESSAGE`

### Step 5 — Wire intent heuristic and KB call into `handler`

In the main `handler` function, after the `userMessage` insert (line ~417) and before `loadIpLayer` and context loading, add the KB Explorer call. Use a local variable to hold the result:

```ts
// KB Explorer routing
let kbResult: { resultSummary: string; steps: AgentStep[] } | null = null;
if (shouldCallKbExplorer(text)) {
  kbResult = await callKbExplorer(userId, text, threadId!, userMessage.data.id);
}
```

Place this AFTER `userMessage` is inserted (you need `userMessage.data.id`). Run it concurrently with `loadIpLayer`, `recentResult`, `founderContext`, and `projectResult` by including it in the `Promise.all` — OR run it sequentially before the `Promise.all` to keep it simple. Sequential is fine for beta; document your choice.

### Step 6 — Pass `kbFindings` to `assemblePrompt()`

Update the `assemblePrompt(...)` call to include:

```ts
kbFindings: kbResult?.resultSummary ?? undefined,
```

### Step 7 — Add `agentSteps` to the `done` SSE payload

In `writeSse(res, 'done', {...})`, update `assistantMessage` to include the steps:

```ts
assistantMessage: {
  id: assistantMessage.data.id,
  chatId: threadId,
  role: 'assistant',
  content: assistantText,
  createdAt: assistantMessage.data.created_at,
  agentSteps: kbResult?.steps ?? undefined,
},
```

`agentSteps` is `undefined` (not `[]`) when KB Explorer was not invoked. This lets the client distinguish "KB not invoked" from "KB invoked but returned 0 steps."

---

## Task 9B — `lib/virtualCsoMockData.ts`

### Step 8 — Add `AgentStep` interface and update `Message`

```ts
export interface AgentStep {
  tool: string;
  input: Record<string, unknown>;
  output: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  agentSteps?: AgentStep[];
}
```

---

## Task 9C — `lib/virtualCsoApi.ts`

### Step 9 — Update `toMessage()` to pass through `agentSteps`

```ts
const toMessage = (row: any): Message => ({
  id: row.id,
  chatId: row.thread_id ?? row.chatId,
  role: row.role,
  content: row.content,
  createdAt: row.created_at ?? row.createdAt,
  agentSteps: row.agentSteps ?? undefined,
});
```

---

## Task 9D — Create `components/pro-suite/virtual-cso/AgentStepsPanel.tsx`

Create a new file. The component is collapsible, defaults to collapsed, shows a summary header, and expands to show individual tool steps.

```tsx
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AgentStep } from '../../../lib/virtualCsoMockData';

export const AgentStepsPanel: React.FC<{ steps: AgentStep[] }> = ({ steps }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg-3)] hover:text-[var(--fg-2)] transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="aos-mono">
          KB Explorer used {steps.length} {steps.length === 1 ? 'tool' : 'tools'}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--aos-mist)] px-3 py-2 space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="text-xs">
              <div className="aos-mono text-[var(--fg-3)] font-medium">{step.tool}</div>
              {Object.keys(step.input).length > 0 && (
                <div className="text-[var(--fg-4)] mt-0.5 truncate">
                  {JSON.stringify(step.input).slice(0, 80)}
                </div>
              )}
              <div className="text-[var(--fg-3)] mt-0.5 line-clamp-2">
                {step.output.slice(0, 120)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Design tokens used:**
- `var(--bg-sunken)` — slightly recessed background, distinct from main canvas
- `var(--aos-mist)` — hairline border
- `var(--fg-3)` / `var(--fg-4)` — muted text, not competing with primary content
- `aos-mono` — Geist Mono for tool names and counts (data/system aesthetic)

**No brass, no obsidian, no active-state colors.** This is "thinking block" territory — purposely dim.

---

## Task 9E — Refactor `components/pro-suite/virtual-cso/MessageBubble.tsx`

### Step 10 — Update imports and prop type

Add `AgentStepsPanel` to the import block. The `Message` type already has `agentSteps?` after Step 8.

```ts
import { AgentStepsPanel } from './AgentStepsPanel';
```

### Step 11 — Refactor assistant branch

The assistant branch currently wraps content in a bubble container. Remove that container.

**Current assistant return (lines 32–49):**
```tsx
return (
  <div className="group flex flex-col items-start">
    <div className="max-w-[88%] rounded-[var(--radius-sm)] rounded-tl-sm border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-soft-1)]">
      <div className="os-reader-markdown text-sm">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
    </div>
    <button
      onClick={onCopy}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--fg-3)] opacity-0 transition-all hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] focus:opacity-100 group-hover:opacity-100"
      title="Copy message"
      aria-label="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  </div>
);
```

**New assistant return:**
```tsx
return (
  <div className="group flex flex-col items-start w-full">
    {message.agentSteps && message.agentSteps.length > 0 && (
      <AgentStepsPanel steps={message.agentSteps} />
    )}
    <div className="os-reader-markdown text-sm w-full">
      <ReactMarkdown>{message.content}</ReactMarkdown>
    </div>
    <button
      onClick={onCopy}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--fg-3)] opacity-0 transition-all hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] focus:opacity-100 group-hover:opacity-100"
      title="Copy message"
      aria-label="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  </div>
);
```

**What changed:**
- Removed the inner `<div className="max-w-[88%] rounded...border...bg-[var(--bg-surface)]...shadow...">` wrapper entirely
- `os-reader-markdown` is now a direct child of the outer div
- Added `w-full` to both outer div and markdown div
- Added `AgentStepsPanel` before the markdown, conditionally rendered

**What did NOT change:**
- User message branch — completely untouched
- Copy button — same classes, same behavior
- `onCopy` handler logic — same

---

## Compile Check

After completing all tasks, run:

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "api/vcso/chat|lib/virtualCsoApi|lib/virtualCsoMockData|MessageBubble|AgentStepsPanel" | head -30
```

Fix any TypeScript errors in the files you touched. Pre-existing errors in unrelated files are out of scope — document them in your report if they surface.

Also run:

```bash
python -m compileall python-backend/main.py python-backend/services/sub_agent_orchestrator.py 2>&1
```

Phase 9 makes no Python changes, but confirm there's no accidental damage.

---

## Smoke Tests to Confirm

Document pass/fail for each in your report:

| Check | What to verify |
|---|---|
| 9A-1 | `shouldCallKbExplorer("find my Q1 report")` returns `true` |
| 9A-2 | `shouldCallKbExplorer("what's my growth bottleneck this quarter")` returns `false` |
| 9A-3 | `shouldCallKbExplorer("I uploaded a transcript, can you summarize it")` returns `true` |
| 9A-4 | `AgentRunRequest` field names in `callKbExplorer()` match `python-backend/main.py` lines 283–291 exactly |
| 9A-5 | `KB EXPLORER FINDINGS` section appears in the `assemblePrompt` sections array at position 13 (zero-indexed: 12) |
| 9A-6 | `done` SSE payload's `assistantMessage` includes `agentSteps` field when `kbResult` is non-null |
| 9B-1 | `Message` interface in `virtualCsoMockData.ts` has `agentSteps?: AgentStep[]` |
| 9B-2 | `toMessage()` in `virtualCsoApi.ts` includes `agentSteps: row.agentSteps ?? undefined` |
| 9C-1 | `AgentStepsPanel.tsx` exists at `components/pro-suite/virtual-cso/AgentStepsPanel.tsx` |
| 9C-2 | `AgentStepsPanel` uses `ChevronRight` for collapse toggle and `aos-mono` class for tool names |
| 9D-1 | `MessageBubble.tsx` assistant branch has NO `border border-[var(--aos-mist)]` or `shadow-[var(--shadow-soft-1)]` on any div |
| 9D-2 | `MessageBubble.tsx` user branch is unchanged (`bg-[var(--aos-slate-blue)]` bubble still present) |
| 9D-3 | `AgentStepsPanel` is imported and conditionally rendered in `MessageBubble.tsx` |
| TS | TypeScript check on touched files returns no new errors |

---

## What NOT to Do

- Do NOT change `VirtualCSOWorkspace.tsx` routing notice or streaming state beyond what naturally flows from `Message.agentSteps`.
- Do NOT persist `agentSteps` to Supabase — `vcso_chat_messages` insert stays as-is.
- Do NOT change `classify()` skill routing — KB routing is parallel and additive.
- Do NOT add a loading spinner or streaming indicator for the KB Explorer call — silent operation only.
- Do NOT change any N8N workflows.
- Do NOT remove or alter the `RECENT THREAD CONTEXT` section from `assemblePrompt` — the KB section is an addition, not a replacement.
- Do NOT change the Python backend at Railway.
- Do NOT import the `openai` package anywhere.

---

## Report Format

When complete, post your report in this format:

```
Implemented Phase 9 — Retrieval Router + Chat Experience.

Changed:
- [api/vcso/chat.ts]: <describe changes>
- [lib/virtualCsoMockData.ts]: <describe changes>
- [lib/virtualCsoApi.ts]: <describe changes>
- [components/pro-suite/virtual-cso/AgentStepsPanel.tsx]: <describe new file>
- [components/pro-suite/virtual-cso/MessageBubble.tsx]: <describe changes>

Smoke tests:
- 9A-1: PASS/FAIL
- 9A-2: PASS/FAIL
- [... all checks ...]
- TS: PASS / <list any new errors in touched files>

Compile (Python): PASS / <describe>

Deviations from spec:
- <any departures, with rationale>

Completion date: <actual date>
```

Update `ROADMAP.md` Phase 9 status to `Done — <date>` and update `Pro-Suite-Progress.md` Phase 9 row accordingly.
