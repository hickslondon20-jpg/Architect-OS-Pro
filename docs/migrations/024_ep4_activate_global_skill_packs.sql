-- Episode 4 verification: preserved platform/global skills must be active
-- for Skills Library visibility and Virtual CSO registry invocation.

UPDATE public.skill_packs
SET status = 'active',
    last_updated = now()
WHERE scope = 'global'
  AND status = 'draft';
