-- Migration: Create Quarter Map Selections Table

CREATE TABLE IF NOT EXISTS public.quarter_map_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter_name TEXT NOT NULL,
  selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked')),
  synthesis_output TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, quarter_name)
);

-- Enable RLS
ALTER TABLE public.quarter_map_selections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own quarter map selections"
  ON public.quarter_map_selections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quarter map selections"
  ON public.quarter_map_selections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quarter map selections"
  ON public.quarter_map_selections FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_quarter_map_selections_updated_at ON public.quarter_map_selections;
CREATE TRIGGER set_quarter_map_selections_updated_at
BEFORE UPDATE ON public.quarter_map_selections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Add 'PARKING_LOT' to BucketType if needed in frontend? We just store JSON so it's fine.
