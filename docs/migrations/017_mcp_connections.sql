-- Phase 5 Advanced Tool Calling (MCP Client Scaffold): metadata-only
-- per-user MCP connection records. Secrets are stored in Supabase Vault and
-- referenced by vault_secret_id; this table must never hold secret material.

CREATE TABLE IF NOT EXISTS public.mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_name text NOT NULL,
  transport text NOT NULL CHECK (transport IN ('stdio', 'http')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_type text NOT NULL CHECK (auth_type IN ('api_key', 'oauth2')),
  vault_secret_id uuid,
  status text NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('coming_soon', 'disabled', 'connected')),
  oauth_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_connections_no_secret_keys CHECK (
    NOT (
      config ? 'secret'
      OR config ? 'api_key'
      OR config ? 'access_token'
      OR config ? 'refresh_token'
      OR config ? 'client_secret'
      OR config ? 'password'
    )
  ),
  CONSTRAINT mcp_connections_unique_user_server UNIQUE (user_id, server_name)
);

COMMENT ON TABLE public.mcp_connections IS
  'Metadata-only MCP connection scaffold. Secret material lives in Supabase Vault, never in this table.';
COMMENT ON COLUMN public.mcp_connections.config IS
  'Non-secret connection metadata only. API keys, OAuth access tokens, refresh tokens, and client secrets are forbidden.';
COMMENT ON COLUMN public.mcp_connections.vault_secret_id IS
  'Reference to Supabase Vault secret id. Decrypt only service-side through vault.decrypted_secrets.';
COMMENT ON COLUMN public.mcp_connections.oauth_expires_at IS
  'Forward-compatible OAuth metadata. Refresh/rotation/revocation is intentionally stubbed for beta.';

CREATE INDEX IF NOT EXISTS idx_mcp_connections_user_id ON public.mcp_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_connections_status ON public.mcp_connections(status);

ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mcp_connections FROM anon, authenticated;
GRANT SELECT ON public.mcp_connections TO authenticated;

DROP POLICY IF EXISTS "mcp_connections_select_own" ON public.mcp_connections;
CREATE POLICY "mcp_connections_select_own"
  ON public.mcp_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No authenticated INSERT/UPDATE/DELETE policies are defined in beta. The
-- backend service role may manage metadata rows for future v2 live connectors;
-- founders can only read their own non-secret metadata.
