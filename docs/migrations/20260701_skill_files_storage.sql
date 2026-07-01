-- Phase 1 (Agent Skills & Document Generation Engine): skill-files bucket + skill_files metadata.

-- 1. Bucket (private; access controlled by storage.objects RLS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Metadata table
CREATE TABLE IF NOT EXISTS public.skill_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES public.skill_packs(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('scripts', 'references', 'assets')),
  mime_type     TEXT,
  size          BIGINT,
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skill_files_skill_id_idx ON public.skill_files (skill_id);
CREATE INDEX IF NOT EXISTS skill_files_category_idx ON public.skill_files (category);

CREATE OR REPLACE FUNCTION public.update_skill_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skill_files_updated_at_trigger
  BEFORE UPDATE ON public.skill_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_skill_files_updated_at();

ALTER TABLE public.skill_files ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_files TO authenticated;

-- 3. RLS on skill_files: mirrors skill_packs scope/ownership.
CREATE POLICY "skill_files_select_own_or_global"
  ON public.skill_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_packs sp
      WHERE sp.id = skill_files.skill_id
        AND (sp.scope = 'global' OR sp.user_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "skill_files_insert_own"
  ON public.skill_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skill_packs sp
      WHERE sp.id = skill_files.skill_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "skill_files_update_own"
  ON public.skill_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_packs sp
      WHERE sp.id = skill_files.skill_id
        AND sp.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skill_packs sp
      WHERE sp.id = skill_files.skill_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "skill_files_delete_own"
  ON public.skill_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_packs sp
      WHERE sp.id = skill_files.skill_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

-- 4. RLS on storage.objects for the skill-files bucket.
CREATE POLICY "skill_files_select_own_folder"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "skill_files_insert_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "skill_files_update_own_folder"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "skill_files_delete_own_folder"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Global-skill-file access: open-read for admin-owned folders; writes remain owner-only above.
CREATE POLICY "skill_files_select_global_folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'skill-files'
    AND private.is_skill_admin(((storage.foldername(name))[1])::uuid)
  );

-- Rollback:
-- DROP POLICY IF EXISTS "skill_files_select_global_folder" ON storage.objects;
-- DROP POLICY IF EXISTS "skill_files_select_own_folder" ON storage.objects;
-- DROP POLICY IF EXISTS "skill_files_insert_own_folder" ON storage.objects;
-- DROP POLICY IF EXISTS "skill_files_update_own_folder" ON storage.objects;
-- DROP POLICY IF EXISTS "skill_files_delete_own_folder" ON storage.objects;
-- DROP TABLE IF EXISTS public.skill_files CASCADE;
-- DROP FUNCTION IF EXISTS public.update_skill_files_updated_at CASCADE;
-- DELETE FROM storage.buckets WHERE id = 'skill-files';
