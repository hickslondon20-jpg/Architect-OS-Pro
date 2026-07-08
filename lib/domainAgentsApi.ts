import { supabase } from './supabaseClient';
import type { DomainAgent, DomainArtifact, DomainTask, RequestCaptureEntry } from '../pages/ProSuite/domain-agents/types';

const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;

export interface DomainAgentProfilePayload {
  agent: DomainAgent;
  recentTasks: DomainTask[];
  recentArtifacts: DomainArtifact[];
}

export interface FreeformResponse {
  request: RequestCaptureEntry;
  mapped: boolean;
  task?: { id: string } | null;
}

const getBaseUrl = () => {
  if (!INGESTION_API_URL) throw new Error('Domain Agents backend is not configured.');
  return INGESTION_API_URL.replace(/\/$/, '');
};

const getAuthHeaders = async (json = true) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to use Domain Agents.');
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

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Domain Agents request failed.'));
  return response.json();
};

export const listDomainAgents = async (): Promise<DomainAgent[]> => {
  const payload = await getJson<{ agents: DomainAgent[] }>('/api/domain-agents');
  return payload.agents;
};

export const getDomainAgentProfile = async (agentId: string): Promise<DomainAgentProfilePayload> =>
  getJson<DomainAgentProfilePayload>(`/api/domain-agents/${encodeURIComponent(agentId)}`);

export const listDomainTasks = async (filters: {
  agent?: string;
  status?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<DomainTask[]> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') params.set(key, value);
  });
  const payload = await getJson<{ tasks: DomainTask[] }>(`/api/tasks${params.size ? `?${params}` : ''}`);
  return payload.tasks;
};

export const listDomainArtifacts = async (filters: {
  agent?: string;
  workflow?: string;
  type?: string;
} = {}): Promise<DomainArtifact[]> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') params.set(key, value);
  });
  const payload = await getJson<{ artifacts: DomainArtifact[] }>(`/api/artifacts${params.size ? `?${params}` : ''}`);
  return payload.artifacts;
};

export const submitFreeformRequest = async (agentId: string, request: string): Promise<FreeformResponse> => {
  const response = await fetch(`${getBaseUrl()}/api/domain-agents/${encodeURIComponent(agentId)}/freeform`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({ request }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not capture request.'));
  return response.json();
};
