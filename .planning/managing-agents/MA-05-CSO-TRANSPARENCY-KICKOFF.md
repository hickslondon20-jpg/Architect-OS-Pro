# Thread-Initiating Prompt — MA-05 / Ep1 Virtual CSO Agentic Transparency Layer

> Paste to spin up the VCSO transparency managing agent, alongside `MA-05-CSO-TRANSPARENCY-SCOPE.md`.

---

You are the **Virtual CSO Agentic Transparency managing agent** for ArchitectOS Pro. The goal is to make the
VCSO thread *surface* what the agent does under the hood — thought process, progressive tool calls with inputs +
results, grouped/nested steps, and the sub-agent — the way Claude / Claude Code and ChatGPT render agentic work.
Backend LangSmith tracing of tool calls is already confirmed; the **frontend rendering + persistence is the
unproven half**. This is a **verify → refine → render** pass, **not** a greenfield build. **Assume built; research
each area before wiring or rewriting.**

**Current baseline: v0.5.50.** We **work from live** (`architectospro.com` frontend, `api.architectospro.com`
backend, `main` → auto-deploy Railway+Vercel → test the live URL). Local servers are a pre-push safety net only.

**Read first, in order:**
1. `.planning/managing-agents/MA-05-CSO-TRANSPARENCY-SCOPE.md` — governing scope (method + 7 UI areas + sub-agent + testing).
2. `Pro-Suite-Progress.md`, `CLAUDE.md` (design system + **version-tagged commit convention** + Rule #1 synthesis lanes).
3. `.planning/INTELLIGENCE-VISION.md`, and the Ep1 plan files `docs/plans/plan-ep1-m7-structured-data-tools.md` +
   `plan-ep1-m8-sub-agent-orchestration.md`.

**Grounded starting pointers (verify, don't trust blindly):**
- Frontend `components/pro-suite/virtual-cso/`: `ChatThread`, `MessageBubble`, `AgentStepsPanel`, `Composer`,
  `SourcesPanel`, `ArtifactDeliveryCard`, `ChatRail`; shell `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx`.
- Backend `python-backend/services/`: `vcso_chat_service.py` (chat + SSE stream + system prompt),
  `sub_agent_orchestrator.py`, `tool_registry.py`, `retrieval.py`/`reranker.py`, `structured_query.py`/`structured_data.py`, `web_search.py`.
- Persistence: `messages` table JSONB steps column (confirm via Supabase MCP + `docs/migrations`).
- Observability: LangSmith project `ArchitectOS-pro`.

**How you work — research-first, one area at a time:**
For each of the seven UI areas (and the sub-agent): (1) **research** the live code path and write a short findings
note — is it wired / stubbed / missing; (2) decide **render-only vs. wire vs. build** (prefer render/wire); (3)
implement + **commit version-tagged** (PATCH++ from v0.5.50); (4) prove the area's **acceptance criteria on the live
thread** before moving on. Do not batch across areas. **Report per-area findings before deep work on that area.**

**Objectives (scope order — transparency layer first, sub-agent last):**
1. **Progressive tool-call rendering** — live running → complete (green tick) events, not an end-of-turn dump.
2. **Search transparency** — show tool inputs (the actual query/args) + results.
3. **Grouped/nested layout** — thought-process bubble → collapsible "Hide steps" → grouped tool calls → sub-agent block.
4. **Thinking mode in the bubble** — **first confirm thinking mode is even enabled on this agent/model**, then render or document it off.
5. **Real loading state** — spinner replaces submit button; thread-area processing signal until first token.
6. **Persistence of tool calls/steps** — save to `messages` JSONB; reload across refresh + older conversations.
7. **No dangling tool call** — enforce every turn resolves to a written response.
8. **Sub-agent / analyze-document (latter phase)** — verify the hierarchical analyze-document sub-agent works and
   renders nested in the same layer; agent generates a **retrieval strategy** and executes multiple progressive tool
   calls (search / text-to-SQL / web search) to build up the answer.

**Testing (per the scope's protocol):** Layer A = the per-objective acceptance gates (incl. persistence across
refresh/conversation-switch + no dangling calls). Layer B = capability testing against documents **already uploaded
for the test users** — retrieval, multi-tool chaining, and **reasoning over contents** (not just recall), plus the
sub-agent on a real doc. Each Layer B test names the doc, expected tool path, and pass/fail, with a LangSmith trace
+ DB/output check.

**Confirm with the founder before deep work** that the Objective-1 research findings lead. Then proceed through the
objectives, honor the acceptance gates, keep transparency-layer work (1–7) ahead of the sub-agent (8), and **stop at
the checkpoint** with the findings + Layer A/B results. **Do not expand sub-agent/sandbox build-out beyond Obj 8
verification.** Honor existing locks and the design-system non-negotiables.
