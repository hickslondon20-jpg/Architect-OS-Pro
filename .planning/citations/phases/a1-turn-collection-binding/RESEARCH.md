# A1 RESEARCH — The live VCSO turn loop (extraction)

**Extraction target:** `python-backend/services/vcso_chat_service.py` — the Virtual CSO streaming tool loop
A1 modifies. This pins how sources are collected, how the answer is produced, what the stream emits, and how
a turn persists, so the execution agent wires binding into the real loop. **Re-verify line anchors before
editing — they drift.** Verified 2026-07-06.

---

## §1 Two source pools exist today (A1 unifies both)

**Pool 1 — context/route display refs** (`vcso_chat_service.py:168–181`). Built right after `_build_context`:

```python
source_refs = [{"kind": "wiki", "label": page.page_title, "pageId": page.id} for page in founder_pages]
source_refs += [{"kind": "platform", "label": key...} for key in route["required"]]
source_refs += [{"kind": "ip", "label": skill...} for skill in route["selected"]]
if linked_folder: source_refs += [{"kind": "context", "label": f"linked: {linked_folder}"}]
```

Emitted at the end in the `done` event as `"sources": source_refs` (`:570`). **Divergent shape** (`kind`, not
`source_kind`). Adapter: `from_vcso_stream_ref` (A0).

**Pool 2 — tool-execution refs** (`vcso_chat_service.py:399–400`). Inside the tool loop, per tool result:

```python
step_sources = [source.to_dict() for source in envelope.sources]   # ToolSourceRef dicts
all_sources.extend(step_sources)
```

`all_sources` accumulates across rounds; also attached per trace step as `sourceRefs` (`:407, :423, :437`).
Adapter: `from_tool_source_ref` (A0). Sub-agent tool results carry `AgentSourceRef`-derived citations →
`from_agent_source_ref` / provenance path.

**A1 must normalize BOTH into one deduped turn `CitationRef[]`.**

---

## §2 The answer is a separate tool-less streaming pass (the binding injection point)

`vcso_chat_service.py:491–507`

```python
messages.append({"role": "user", "content": "Now write the final answer to the founder. Do not call more tools."})
with self.anthropic_client.messages.stream(model=..., system=system_prompt, messages=messages) as stream:
    for text in stream.text_stream:
        assistant_text += text
        yield {"event": "token", "data": {"text": text}}
```

**Today this pass gets no numbered source list and no citation instruction** — the model just writes prose.
It *does* see prior `tool_result` JSON blocks in `messages`, but no evidence markers (reference-style marking
is absent — consistent with our source-ref-first choice, DP2). **A1 injects here:** a numbered source list +
a cite-with-`[n]` instruction (in `VCSO_TOOL_LOOP_SYSTEM_PROMPT` and/or this final-answer message), then
parses `[n]` from `stream.text_stream`. System prompt constant: `VCSO_TOOL_LOOP_SYSTEM_PROMPT` (~line 60s) +
`VCSO_DEEP_MODE_SYSTEM_PROMPT`.

---

## §3 Stream events (what the frontend consumes — F4)

Per turn the service yields: `ready` (:222), `step` (:314) + `tool_call` (:325) + `tool_result` (:427) each
carrying `sourceRefs` (currently `step_sources` dicts), `token` (:503), `context` (:560), and `done` (:561)
carrying `sources: source_refs` (Pool 1) + `sourcePages` + `assistantMessage`. Deep mode also: `ask_user`
(:365), `done_waiting`, `todos_updated`, `workspace_updated`. **A1 changes the `sourceRefs` on step/result
events and `sources` on `done` to `CitationRef` shape**; keep the event names + lifecycle (C-9).

---

## §4 Persistence + reload (the reload-safe home for citations)

- Assistant message: `self._insert_message(thread_id, user_id, "assistant", assistant_text, token_count=...)`
  (`:526–541`). **Confirm whether the messages table has a `citations`/`source_refs` column; if not, add one**
  — the turn `CitationRef[]` persists here so chips survive reload (O3 reload-safety).
- Run completion: `_complete_main_run(run_id, user_id, assistant_message["id"], assistant_text, all_sources)`
  (`:543`) — `all_sources` currently persists onto the *run*, per-step refs onto run steps (`_create_step`,
  `source_refs=` :423). The `done` event returns `assistantMessage` + `agentSteps: trace_steps` for reload.

## §5 Deep-mode resume (must preserve citation state)

`all_sources`, `trace_steps`, `messages` are persisted/restored across an `ask_user` pause: persist at
`:353–364` (`_persist_deep_resume(..., all_sources=all_sources, ...)`), restore at `:245–269`
(`all_sources = list(resume_state.get("all_sources") or [])`). **A1's collected citation state must ride the
same resume path** so a resumed turn keeps its numbering.

---

## §6 Adapters this phase uses (from A0 `normalize.py`)

`from_vcso_stream_ref` (Pool 1) · `from_tool_source_ref` (Pool 2) · `from_agent_source_ref` /
`from_provenance_ref` (sub-agent / provenance refs) · `parse_inline_source_marker` (verbatim `[[Source:]]`
escape hatch). All accept live dataclass instances **or** serialized dicts (A0 completion note) — Pool 2 is
already `.to_dict()`'d at `:399`.

## §7 The decided binding scheme (O3 — CONTEXT §8, 2026-07-06)

Per-message ordinal `[n]` over the deduped turn `CitationRef[]`; dedup key `(source_kind_family, source_id)`
+ content-hash fallback; invalid `[n]` dropped; `[[Source:]]` verbatim marker coexists; cross-turn numbering
deferred. Reload-safe via the assistant-message persistence in §4.
