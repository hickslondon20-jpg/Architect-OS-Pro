-- Episode 7 A1 - reload-safe citation refs on assistant messages.
-- The VCSO run table already carries run-level citations; this column is the
-- per-assistant-message home for the ordered turn CitationRef[].

alter table public.vcso_chat_messages
  add column if not exists citations jsonb not null default '[]'::jsonb;
