import { supabase } from './supabaseClient';
import type { ArtifactDelivery } from './virtualCsoMockData';

const PYTHON_BACKEND_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;

const backendApiUrl = (path: string) => {
  if (!PYTHON_BACKEND_URL) return path;
  const normalizedBaseUrl = /^https?:\/\//i.test(PYTHON_BACKEND_URL)
    ? PYTHON_BACKEND_URL
    : `https://${PYTHON_BACKEND_URL}`;
  return `${normalizedBaseUrl.replace(/\/$/, '')}${path}`;
};

const requireAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to view artifacts.');
  return token;
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
  const token = await requireAccessToken();
  const response = await fetch(backendApiUrl(`/api/artifacts/${artifactId}`), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not load artifact.'));
  return response.json();
};
