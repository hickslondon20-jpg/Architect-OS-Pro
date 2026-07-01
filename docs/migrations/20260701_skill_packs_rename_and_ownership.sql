-- Phase 1 (Agent Skills & Document Generation Engine): rename ip_skill_packs -> skill_packs,
-- add founder ownership + ownership-derived scope, admin designation on profiles.

-- 1. Admin designation (reuse profiles, per CONTEXT.md #2; no new single-purpose table)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- London admin account confirmed live from auth.users on 2026-07-01.
UPDATE public.profiles
SET is_admin = true
WHERE user_id = '4ef8c0e3-d0bf-4420-990d-3d5dbe1aa1aa';

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_skill_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = check_user_id
      AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION private.is_skill_admin(UUID) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_skill_admin(UUID) TO authenticated;

-- 2. Rename + extend
ALTER TABLE public.ip_skill_packs RENAME TO skill_packs;

ALTER TABLE public.skill_packs
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'private' CHECK (scope IN ('global', 'private'));

-- 3. Backfill the 6 pre-existing rows as global admin content
UPDATE public.skill_packs
SET user_id = '4ef8c0e3-d0bf-4420-990d-3d5dbe1aa1aa',
    scope = 'global'
WHERE user_id IS NULL;

-- 4. Now that every row has an owner, enforce NOT NULL
ALTER TABLE public.skill_packs ALTER COLUMN user_id SET NOT NULL;

-- 5. Structural write-lock: only admin-flagged accounts may own scope = 'global'
CREATE OR REPLACE FUNCTION public.enforce_skill_pack_global_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scope = 'global' AND NOT private.is_skill_admin(NEW.user_id) THEN
    RAISE EXCEPTION 'skill_packs.scope can only be global for admin-owned accounts (user_id=%)', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.enforce_skill_pack_global_scope() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER skill_packs_enforce_global_scope
  BEFORE INSERT OR UPDATE ON public.skill_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_skill_pack_global_scope();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS skill_packs_user_id_idx ON public.skill_packs (user_id);
CREATE INDEX IF NOT EXISTS skill_packs_scope_idx ON public.skill_packs (scope);

-- 7. Expose to authenticated founders; RLS below controls row-level access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_packs TO authenticated;

-- 8. RLS: keep the existing service-role ALL/true policy, add founder-facing read + owner writes.
CREATE POLICY "skill_packs_select_own_or_global"
  ON public.skill_packs FOR SELECT
  USING (scope = 'global' OR user_id = (SELECT auth.uid()));

CREATE POLICY "skill_packs_insert_own"
  ON public.skill_packs FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "skill_packs_update_own"
  ON public.skill_packs FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "skill_packs_delete_own"
  ON public.skill_packs FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- Rollback:
-- DROP TRIGGER IF EXISTS skill_packs_enforce_global_scope ON public.skill_packs;
-- DROP FUNCTION IF EXISTS public.enforce_skill_pack_global_scope;
-- DROP FUNCTION IF EXISTS private.is_skill_admin;
-- DROP POLICY IF EXISTS "skill_packs_select_own_or_global" ON public.skill_packs;
-- DROP POLICY IF EXISTS "skill_packs_insert_own" ON public.skill_packs;
-- DROP POLICY IF EXISTS "skill_packs_update_own" ON public.skill_packs;
-- DROP POLICY IF EXISTS "skill_packs_delete_own" ON public.skill_packs;
-- ALTER TABLE public.skill_packs DROP COLUMN scope, DROP COLUMN user_id;
-- ALTER TABLE public.skill_packs RENAME TO ip_skill_packs;
-- ALTER TABLE public.profiles DROP COLUMN is_admin;
