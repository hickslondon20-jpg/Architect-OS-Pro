import { supabase } from './supabaseClient';

const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;

export type SkillPack = {
  id: string;
  slug: string;
  name: string;
  description: string;
  domain: string | null;
  skill_kind: string | null;
  trigger_tags: string[];
  required_platform_context: string[];
  body?: string;
  status: string;
  scope: 'global' | 'private';
  user_id: string;
  created_at?: string;
  updated_at?: string;
};

export type SkillPayload = {
  name: string;
  description: string;
  domain?: string | null;
  skill_kind?: string | null;
  trigger_tags: string[];
  required_platform_context: string[];
  body: string;
};

export type GuidedSkillDraft = Partial<SkillPayload> & {
  assistant_message: string;
  ready: boolean;
};

const getBaseUrl = () => {
  if (!INGESTION_API_URL) throw new Error('Skills backend is not configured.');
  return INGESTION_API_URL.replace(/\/$/, '');
};

const getAuthHeaders = async (json = true) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to use skills.');
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

export const loadSkills = async (): Promise<SkillPack[]> => {
  const response = await fetch(`${getBaseUrl()}/api/skills`, {
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not load skills.'));
  return response.json();
};

export const createSkill = async (payload: SkillPayload): Promise<SkillPack> => {
  const response = await fetch(`${getBaseUrl()}/api/skills`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not create skill.'));
  return response.json();
};

export const updateSkill = async (skillId: string, payload: Partial<SkillPayload>): Promise<SkillPack> => {
  const response = await fetch(`${getBaseUrl()}/api/skills/${skillId}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not update skill.'));
  return response.json();
};

export const deleteSkill = async (skillId: string): Promise<void> => {
  const response = await fetch(`${getBaseUrl()}/api/skills/${skillId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not delete skill.'));
};

export const importSkillZip = async (file: File): Promise<SkillPack> => {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${getBaseUrl()}/api/skills/import`, {
    method: 'POST',
    headers: await getAuthHeaders(false),
    body: form,
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not import skill.'));
  return response.json();
};

export const exportSkillZip = async (skill: SkillPack): Promise<void> => {
  const response = await fetch(`${getBaseUrl()}/api/skills/${skill.id}/export`, {
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not export skill.'));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${skill.slug || 'skill'}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const requestGuidedSkillDraft = async (
  messages: Array<{ role: 'founder' | 'assistant'; content: string }>,
  currentDraft: Partial<SkillPayload>,
): Promise<GuidedSkillDraft> => {
  const response = await fetch(`${getBaseUrl()}/api/skills/guided-draft`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ messages, currentDraft }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not draft the skill.'));
  return response.json();
};
