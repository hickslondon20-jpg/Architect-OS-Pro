-- WS5 GATE 0 prepared-only cleanup migration.
-- Apply only after founder confirmation.
-- Live/code findings on 2026-06-17:
--   - Runtime uses vcso_chat_threads, vcso_chat_messages, vcso_projects.
--   - Telemetry uses ai_usage_log.
--   - Code grep found zero virtual_cso_* references in C:\Users\Hicks\ArchitectOS Pro_beta.
--   - All five virtual_cso_* legacy tables were empty in live Supabase.

begin;

drop table if exists public.virtual_cso_errors;
drop table if exists public.virtual_cso_retrieval_log;
drop table if exists public.virtual_cso_routing_log;
drop table if exists public.virtual_cso_messages;
drop table if exists public.virtual_cso_sessions;

commit;
