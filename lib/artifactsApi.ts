import { supabase } from './supabaseClient';
import type { CitationRef } from './virtualCsoApi';

const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;
const ARTIFACT_VERIFY_SECRET = import.meta.env.VITE_ARTIFACT_VERIFY_SECRET as string | undefined;

export interface ArtifactDelivery {
  id: string;
  user_id: string;
  source_kind: string;
  source_id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
  renderable: boolean;
  description?: string | null;
  content?: string | null;
  signed_url?: string | null;
  provenance?: {
    source_refs?: CitationRef[];
    [key: string]: unknown;
  } | null;
}

export interface ArtifactVerifyResult {
  thread_id: string;
  status: string;
  execution: {
    pod_name: string;
    stdout: string;
    stderr: string;
    exit_code: number;
  };
  renderable: ArtifactDelivery;
  downloadable: ArtifactDelivery;
}

const getBaseUrl = () => {
  if (!INGESTION_API_URL) throw new Error('Artifacts backend is not configured.');
  return INGESTION_API_URL.replace(/\/$/, '');
};

const getAuthHeaders = async (json = true) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to use artifacts.');
  return {
    authorization: `Bearer ${token}`,
    ...(json ? { 'content-type': 'application/json' } : {}),
  };
};

const parseApiError = async (response: Response, fallback: string) => {
  const text = await response.text().catch(() => '');
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === 'string') return parsed.detail;
  } catch {
    return text;
  }
  return text;
};

export const getArtifact = async (artifactId: string): Promise<ArtifactDelivery> => {
  const response = await fetch(`${getBaseUrl()}/api/artifacts/${artifactId}`, {
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not load artifact.'));
  return response.json();
};

export const verifyArtifacts = async (threadId: string, userId: string): Promise<ArtifactVerifyResult> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (ARTIFACT_VERIFY_SECRET) headers['x-ingest-secret'] = ARTIFACT_VERIFY_SECRET;
  const response = await fetch(`${getBaseUrl()}/api/artifacts/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ thread_id: threadId, user_id: userId }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not verify artifact delivery.'));
  return response.json();
};
