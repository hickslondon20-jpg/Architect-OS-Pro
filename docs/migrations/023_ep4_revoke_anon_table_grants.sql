-- MA-04 Obj-0 hardening: Ep4 data tables are authenticated/service-role surfaces only.
-- RLS already owner-scopes rows, but anon table grants are unnecessary exposure.

revoke all privileges on public.agent_delegation_runs from anon;
revoke all privileges on public.agent_delegation_steps from anon;
revoke all privileges on public.artifacts from anon;
revoke all privileges on public.skill_files from anon;
