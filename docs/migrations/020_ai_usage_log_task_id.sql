alter table public.ai_usage_log
  add column if not exists task_id uuid;

create index if not exists ai_usage_log_task_id_idx
  on public.ai_usage_log(task_id, created_at desc);
