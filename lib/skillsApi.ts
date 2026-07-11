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
  try {
    return await importSkillZipAsJson(file);
  } catch (jsonErr) {
    try {
      return await importSkillZipAsMultipart(file);
    } catch (multipartErr) {
      const jsonDetail = jsonErr instanceof Error ? jsonErr.message : 'JSON import failed.';
      const multipartDetail = multipartErr instanceof Error ? multipartErr.message : 'Multipart import failed.';
      throw new Error(`Could not import skill. JSON: ${jsonDetail}. Multipart: ${multipartDetail}`);
    }
  }
};

const importSkillZipAsJson = async (file: File): Promise<SkillPack> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  const response = await fetch(`${getBaseUrl()}/api/skills/import-json`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      filename: file.name,
      contentBase64: btoa(binary),
    }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not import skill.'));
  return response.json();
};

const importSkillZipAsMultipart = async (file: File): Promise<SkillPack> => {
  const form = new FormData();
  form.append('file', file);
  const url = `${getBaseUrl()}/api/skills/import`;
  const headers = await getAuthHeaders(false);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers,
      body: form,
    });
  } catch (err) {
    try {
      return await importSkillZipWithXhr(url, headers.authorization, form);
    } catch (xhrErr) {
      const detail = err instanceof Error ? err.message : 'The browser could not complete the request.';
      const xhrDetail = xhrErr instanceof Error ? xhrErr.message : 'XHR fallback also failed.';
      throw new Error(`Could not reach the skills import API at ${url}. Fetch: ${detail}. XHR: ${xhrDetail}`);
    }
  }
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not import skill.'));
  return response.json();
};

const importSkillZipWithXhr = (url: string, authorization: string, form: FormData): Promise<SkillPack> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('authorization', authorization);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText) as SkillPack);
        } catch {
          reject(new Error('Import completed, but the response could not be parsed.'));
        }
        return;
      }
      try {
        const parsed = JSON.parse(request.responseText) as { detail?: unknown };
        if (typeof parsed.detail === 'string') {
          reject(new Error(parsed.detail));
          return;
        }
      } catch {
        // Fall through to the generic response body.
      }
      reject(new Error(request.responseText || `HTTP ${request.status}`));
    };
    request.onerror = () => reject(new Error('Network error'));
    request.ontimeout = () => reject(new Error('Request timed out'));
    request.timeout = 60000;
    request.send(form);
  });

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
