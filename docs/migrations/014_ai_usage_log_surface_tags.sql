-- Allow the tagged usage stream to record the live intelligence-layer surfaces.

alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_surface_check;

alter table public.ai_usage_log
  add constraint ai_usage_log_surface_check
  check (
    surface in (
      'chat',
      'synthesis',
      'ingestion',
      'ip_maintenance',
      'ws5-chat',
      'virtual_cso',
      'os_engine',
      'skills'
    )
  );
