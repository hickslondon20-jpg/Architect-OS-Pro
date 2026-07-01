# Phase 9 — RESEARCH.md
# Retrieval Router + Chat Experience

*Verify pass completed: 2026-07-01*
*Files read: `api/vcso/chat.ts`, `api/vcso/writeback.ts`, `lib/virtualCsoApi.ts`, `lib/virtualCsoMockData.ts`, `components/pro-suite/virtual-cso/MessageBubble.tsx`, `python-backend/main.py`, `python-backend/services/agent_capabilities.py`*

---

## 1. Python Backend Connection Pattern

Confirmed by reading `api/vcso/writeback.ts` (lines 73–79):

```ts
const backendUrl = process.env.ARCHITECTOS_PYTHON_BACKEND_URL;
// Auth header:
'x-ingest-secret': process.env.ARCHITECTOS_INGEST_SECRET
```

Both env vars are already present in the Vercel environment (used by the writeback endpoint). `chat.ts` can use the same pattern — no new env vars needed.

---

## 2. `/api/agent-runs` Request Schema

Confirmed from `python-backend/main.py` lines 283–291 (`AgentRunRequest`):

```json
{
  "user_id": "<Supabase user UUID>",
  "parent_surface": "virtual_cso",
  "capability_key": "kb_explorer_agent",
  "task_summary": "<founder's question, verbatim>",
  "context_scope": {},
  "task_title": null,
  "parent_thread_id": "<threadId or null>",
  "parent_message_id": "<userMessage.data.id or null>"
}
```

**Key constraints:**
- `user_id`, `parent_surface`, `capability_key`, `task_summary` are required (`min_length=1`)
- `task_summary` max 4000 chars — if founder message exceeds this, slice before sending
- `parent_surface` must match an entry in `allowed_surfaces`; `"virtual_cso"` is confirmed allowed for `kb_explorer_agent` (line 149 of `agent_capabilities.py`)

---

## 3. `/api/agent-runs` Response Schema

Confirmed from `python-backend/main.py` lines 294–301 (`AgentRunResponse`):

```json
{
  "run_id": "...",
  "status": "completed | failed | ...",
  "result_summary": "...",
  "structured_result": { "..." },
  "trace": [ { "tool": "...", "input": {...}, "output": "..." } ],
  "citations": [],
  "error_message": null
}
```

**What Phase 9 uses:**
- `result_summary` → inject into `assemblePrompt()` as `KB EXPLORER FINDINGS` section
- `trace` → convert to `AgentStep[]` for the collapsible `AgentStepsPanel` UI
- `error_message` → if non-null, log and fall through to base synthesis (don't surface to user)

The `trace` array contains tool-call records. Each record structure is set by the sub-agent orchestrator. The execution agent must read `python-backend/services/sub_agent_orchestrator.py` in Step 0 to confirm the exact per-trace-entry shape before writing the `AgentStep` interface.

---

## 4. `kb_explorer_agent` Capability Definition

Confirmed from `python-backend/services/agent_capabilities.py` lines 140–156:

```python
AgentCapability(
    capability_key="kb_explorer_agent",
    label="Knowledge Base Explorer",
    status="experimental",
    allowed_surfaces=["virtual_cso", "os_engine", "domain_agent"],
    allowed_tools=["kb_ls", "kb_tree", "kb_grep", "kb_glob", "kb_read"],
    model_setting_key="kb_explorer_agent",
    default_config={"max_rounds": 5, "timeout_seconds": 60},
    can_spawn_agents=False,
)
```

`"virtual_cso"` is an allowed surface. `parent_surface: "virtual_cso"` in the request is correct.

Backend-side timeout is 60 seconds. Phase 9 sets a client-side `Promise.race()` timeout of **10 seconds** — the client times out first and silently falls through to base synthesis. This is intentional: beta founders should not wait >10s for a response.

---

## 5. `Message` Interface — Current State

Confirmed from `lib/virtualCsoMockData.ts` lines 29–35:

```ts
export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
```

**No `agentSteps` field.** This must be added as an optional field for Phase 9.

---

## 6. `toMessage()` — Current State

Confirmed from `lib/virtualCsoApi.ts` lines 95–101:

```ts
const toMessage = (row: any): Message => ({
  id: row.id,
  chatId: row.thread_id ?? row.chatId,
  role: row.role,
  content: row.content,
  createdAt: row.created_at ?? row.createdAt,
});
```

Does not pass through `agentSteps`. Must be updated to spread `agentSteps: row.agentSteps ?? undefined`.

---

## 7. SSE `done` Event Payload — Current State

Confirmed from `api/vcso/chat.ts` lines 544–564:

```ts
writeSse(res, 'done', {
  chat: { id, title, projectId, pinned, lastMessageAt },
  assistantMessage: {
    id: assistantMessage.data.id,
    chatId: threadId,
    role: 'assistant',
    content: assistantText,
    createdAt: assistantMessage.data.created_at,
  },
  sources: sourceRefs,
  sourcePages,
  usage,
});
```

`assistantMessage` in the `done` payload becomes the `Message` object on the client. This is where `agentSteps` must be added **when KB Explorer was invoked**. It is **client-side only** — `agentSteps` is NOT persisted to Supabase (the `vcso_chat_messages` insert at line 507 does not include it).

---

## 8. `assemblePrompt()` — Structure

Confirmed from `api/vcso/chat.ts` lines 251–305:

The function builds a `sections: string[]` array and returns `sections.join('\n\n---\n\n')`. Current sections in order:

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
13. `RESPONSE CONTRACT`
14. `FOUNDER MESSAGE`

**KB injection point:** Insert a new `KB EXPLORER FINDINGS` section between `LINKED FOLDER SCOPE` (#12) and `RESPONSE CONTRACT` (#13). When KB Explorer was NOT invoked, the section reads `KB EXPLORER FINDINGS\nNot invoked for this message.`

The function signature currently takes an args object with named fields. Add `kbFindings?: string` to the args interface and to the call site.

---

## 9. `MessageBubble.tsx` — Current Structure

Confirmed from `components/pro-suite/virtual-cso/MessageBubble.tsx`:

**User message (lines 22–30) — KEEP UNCHANGED:**
```tsx
<div className="flex justify-end">
  <div className="max-w-[78%] rounded-[var(--radius-sm)] rounded-tr-sm bg-[var(--aos-slate-blue)] px-4 py-3 text-sm leading-relaxed text-[var(--fg-on-dark)]">
    {message.content}
  </div>
</div>
```

**Assistant message (lines 32–49) — REFACTOR:**

Current — has bubble container with border/bg/shadow:
```tsx
<div className="group flex flex-col items-start">
  <div className="max-w-[88%] rounded-[var(--radius-sm)] rounded-tl-sm border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-soft-1)]">
    <div className="os-reader-markdown text-sm">
      <ReactMarkdown>{message.content}</ReactMarkdown>
    </div>
  </div>
  <button onClick={onCopy} className="mt-1.5 inline-flex items-center gap-1.5 ... group-hover:opacity-100">
    {copied ? <Check size={13} /> : <Copy size={13} />}
    {copied ? 'Copied' : 'Copy'}
  </button>
</div>
```

Target — remove the inner bubble container; markdown renders directly inside the outer div:
```tsx
<div className="group flex flex-col items-start w-full">
  {/* AgentStepsPanel renders here when agentSteps present */}
  <div className="os-reader-markdown text-sm w-full">
    <ReactMarkdown>{message.content}</ReactMarkdown>
  </div>
  <button onClick={onCopy} className="mt-1.5 ...">
    ...
  </button>
</div>
```

The outer `group flex flex-col items-start` stays. The inner `max-w-[88%] rounded...border...bg-[var(--bg-surface)]...shadow` wrapper is removed entirely. The copy button stays with same behavior.

---

## 10. `VirtualCSOWorkspace.tsx` — Streaming State Pattern

The workspace maintains a streaming message state. `onToken` appends chunk text to a streaming buffer. `onReady` fires the routing notice. The `done` event's `assistantMessage` is the final `Message` that gets committed to state.

The `agentSteps` field, if present on the `done` payload's `assistantMessage`, will be carried through `toMessage()` and stored in the component's message list. No workspace-level logic changes are needed — `MessageBubble` reads `message.agentSteps` directly.

---

## 11. Routing Notice — Current Location

The `onReady` handler in `VirtualCSOWorkspace.tsx` fires a routing notice at the bottom bar. Phase 9 does NOT move or remove this notice. The `AgentStepsPanel` is a separate additional display that appears inside the message — it shows KB-specific tool steps, not the skill-routing result. These are different things and can coexist.

---

## 12. Intent Keyword Patterns

Patterns that reliably indicate "founder is asking about an uploaded document or their KB":

**High-confidence triggers (any match → call KB Explorer):**
- `document`, `file`, `pdf`, `uploaded`, `transcript`, `sop`, `report`
- `find in my`, `search my`, `in my knowledge base`, `in my files`, `in my documents`
- `what does the`, `what's in the`, `according to the`, `per the`
- `briefing`, `summary of`, `read me`, `pull from`

**Exclusions (prevent false positives):**
- Do NOT trigger on messages that are clearly conversational or strategic without a document reference: "what should I prioritize", "how do I grow", "what's my MRA", etc.

Implementation: a simple `shouldCallKbExplorer(text: string): boolean` that lowercases the input and checks for any keyword match. No Claude call. No external lookup. Runs synchronously in ~0ms.

---

## Summary: Files Changed in Phase 9

| File | Change |
|---|---|
| `api/vcso/chat.ts` | Add `AgentStep` type; add intent heuristic fn; add Railway call fn with timeout; inject KB findings into `assemblePrompt()`; add `agentSteps` to `done` SSE payload |
| `lib/virtualCsoMockData.ts` | Add `AgentStep` interface; add `agentSteps?: AgentStep[]` to `Message` |
| `lib/virtualCsoApi.ts` | Update `toMessage()` to pass through `agentSteps` |
| `components/pro-suite/virtual-cso/MessageBubble.tsx` | Remove assistant bubble container; add `AgentStepsPanel` above markdown |
| `components/pro-suite/virtual-cso/AgentStepsPanel.tsx` | New component — create |

No Supabase schema changes. No N8N changes. No Python backend changes.
