-- Knowledge Base Explorer Phase 1: per-user folder tree.

CREATE TABLE IF NOT EXISTS public.kb_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 255),
  parent_id   UUID REFERENCES public.kb_folders(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kb_folders_user_id_idx ON public.kb_folders (user_id);
CREATE INDEX IF NOT EXISTS kb_folders_parent_id_idx ON public.kb_folders (parent_id);
CREATE INDEX IF NOT EXISTS kb_folders_user_parent_idx ON public.kb_folders (user_id, parent_id);

CREATE OR REPLACE FUNCTION public.update_kb_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_folders_updated_at_trigger
  BEFORE UPDATE ON public.kb_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kb_folders_updated_at();

ALTER TABLE public.kb_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_folders_select_own"
  ON public.kb_folders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "kb_folders_insert_own"
  ON public.kb_folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kb_folders_update_own"
  ON public.kb_folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kb_folders_delete_own"
  ON public.kb_folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- Rollback:
-- DROP TABLE IF EXISTS public.kb_folders CASCADE;
-- DROP FUNCTION IF EXISTS public.update_kb_folders_updated_at CASCADE;
