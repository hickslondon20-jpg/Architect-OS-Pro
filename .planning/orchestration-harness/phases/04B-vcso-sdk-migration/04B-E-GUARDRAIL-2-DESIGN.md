# Phase E Guardrail 2 — Transcript Ownership

**Status:** Approved-boundary design note; implementation has not started  
**Date:** 2026-07-23  
**Scope:** Model-driven Virtual CSO Deep Mode only

## Observed baseline

Read-only production SQL on 2026-07-23 showed:

- `vcso_chat_messages`: **215 rows**, not the 211-row planning snapshot;
- `vcso_chat_messages where deep_mode is true`: **0 rows**;
- `vcso_chat_threads`: **91 rows**;
- threads in `waiting_for_user`: **0**;
- non-null `vcso_chat_threads.deep_resume_state`: **0**.

Both `vcso_chat_messages` and `vcso_chat_threads` have founder-owned RLS policies for select, insert,
update, and delete (`auth.uid() = user_id`). No transcript rows were created while resolving this
guardrail.

## Decision: two representations, one context authority

`vcso_chat_messages` remains the **curated founder-visible conversation ledger**. It owns the user and
assistant messages used for thread reload, stream recovery, citations, and the founder-facing history.
It must not hold raw Claude CLI transcript frames, tool payloads, or hidden model output.

The SDK SessionStore transcript is the **machine continuation record** for model-driven Deep Mode. It is
an opaque, lossless pass-through of the SDK JSONL entries required by `resume=<session_id>` and
`fork_session=true`. It is not rendered in the frontend and is not a second founder-facing message
history.

These records relate at the turn boundary:

```
vcso_chat_threads.id
  ├─ vcso_chat_messages.thread_id       curated founder-visible turns
  ├─ active_sdk_session_id              one active Deep Mode continuation pointer
  └─ vcso_sdk_session_entries.thread_id opaque SDK continuation entries
       └─ turn_message_id                founder message that initiated the SDK invocation
```

There is no one-to-one message-to-entry mapping: one visible turn can produce many SDK system, assistant,
tool, and result entries. `turn_message_id` provides an auditable relationship without exposing or
copying raw frames into `vcso_chat_messages`.

## Collapse rule: do not inject history twice

The first model-driven Deep Mode turn may assemble the existing curated thread history into its initial
SDK prompt once. After the SDK session exists:

1. `vcso_chat_threads.active_sdk_session_id` selects the continuation;
2. the SessionStore loads the opaque entries for that founder and session;
3. the next founder message is sent as the resume prompt;
4. `_load_recent_messages` / `_assemble_prompt` must **not** add the same
   `vcso_chat_messages` history again.

Thus `vcso_chat_messages` is a presentation and delivery-recovery ledger on resumed SDK turns, not a
competing context authority. The SDK transcript alone supplies prior model context.

## Persistence boundary

Implement one narrow SDK backing table, `public.vcso_sdk_session_entries`, plus an explicit nullable
`vcso_chat_threads.active_sdk_session_id` pointer.

Each entry row will carry:

- an ordered database identity;
- `user_id`, `thread_id`, and `turn_message_id`;
- SDK `project_key`, `session_id`, and optional `subpath`;
- optional SDK entry UUID for idempotent insert;
- the opaque JSON entry;
- creation time.

Required properties:

- load order is database identity order;
- entries with SDK UUIDs are deduplicated founder/session/subpath-wide;
- UUID-less SDK entries remain append-only as required by the SDK contract;
- deleting a thread cascades its transcript;
- adapter reads always bind `user_id` and `session_id`; `thread_id` is recorded for ownership and
  lifecycle evidence, while same-founder source-session reads permit a legitimate fork into a new
  thread;
- raw transcript entries are backend-only: RLS enabled, service-role access only, no authenticated
  frontend grant or raw-transcript API.

The Supabase 2026 Data API grant change is handled explicitly: this backend-only table will not be
automatically or manually exposed to authenticated clients.

## Deep Mode-only activation

The adapter is constructed only when all of these are true:

- the request is `deepMode=true`;
- the model-driven/SDK founder gate selects the SDK path;
- the thread belongs to the authenticated founder.

Normal chat, stateless SDK chat, planner, workers, Path A, and flag-off fallback receive no SessionStore.
The existing 215 message rows are not backfilled. The transcript table remains empty until an eligible
model-driven Deep Mode turn runs.

## Legacy fallback demarcation

`deep_resume_state` stays in place and is not pruned. Its authority is restricted to the dark hand-rolled
Deep Mode fallback / Path A.

The authority choice is mutually exclusive:

| Selected execution path | Context authority | Writes `deep_resume_state` |
|---|---|---|
| Model-driven SDK Deep Mode | SDK SessionStore + `active_sdk_session_id` | No |
| Hand-rolled fallback / Path A | legacy `deep_resume_state` | Yes |
| Normal/stateless chat | assembled `vcso_chat_messages` context | No |

No SDK Deep Mode turn may read, migrate, clear, or write `deep_resume_state`. No legacy turn may infer a
resume from `active_sdk_session_id`.

## Durability rule for `ask_user`

The waiting state is valid only after the SDK run has produced its terminal result and the transcript
mirror has completed successfully. The sequence is:

1. observe the SDK `ask_user` marker and retain only its curated question;
2. suppress later model prose from the founder answer channel;
3. receive the SDK terminal result and complete the SessionStore flush;
4. persist the active session pointer;
5. only then mark the thread `waiting_for_user` and emit `ask_user` / `done_waiting`.

If transcript persistence or pointer persistence is not observed, the thread must not claim a resumable
waiting state. It transitions to the existing bounded error/recovery path instead.

On the founder reply, the saved user message is the `turn_message_id`, and its text becomes the next SDK
prompt under `resume=<active_sdk_session_id>`. The SDK session—not a synthetic hand-built tool-result
history—restores the paused context.

## Guardrail 2 result

The design does not create three active histories:

- curated messages remain the UI/reload ledger;
- the SDK transcript replaces `deep_resume_state` as context authority only on the SDK Deep Mode path;
- `deep_resume_state` remains an isolated dark fallback, never double-written.

Transcript persistence is explicitly limited to founder-owned model-driven Deep Mode threads.
