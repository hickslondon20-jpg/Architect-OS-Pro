import { supabase } from './supabaseClient';
import type { DomainTask } from '../pages/ProSuite/domain-agents/types';

const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;

export type TaskEventName =
  | 'task_ready'
  | 'task_step_start'
  | 'task_step_complete'
  | 'task_step_error'
  | 'task_blocked'
  | 'task_batch_progress'
  | 'task_sub_agent_start'
  | 'task_sub_agent_complete'
  | 'task_review'
  | 'task_done'
  | 'task_error';

export interface TaskStreamEvent {
  event: TaskEventName;
  payload: Record<string, unknown>;
}

export interface TaskState {
  task: {
    id: string;
    title: string;
    status: DomainTask['status'];
    agent_id: string;
    workflow_id: string | null;
    current_step: number;
    step_results?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  workflow?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  steps: Array<{
    id: string;
    position: number;
    name: string;
    step_type: string;
    workspace_output?: string | null;
  }>;
  workspace: Array<{
    id: string;
    file_path: string;
    source: string;
    size?: number | null;
    storage_path?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  artifact?: {
    id: string;
    filename?: string | null;
    promoted_to_kb: boolean;
    source_kind?: string | null;
    task_id?: string | null;
  } | null;
  resume: {
    status: DomainTask['status'];
    current_step: number;
    next_step?: unknown;
  };
}

export interface WorkspaceFileContent {
  id: string;
  file_path: string;
  content?: string | null;
  source: string;
  size?: number | null;
  storage_path?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaskPromotionResult {
  task_id: string;
  artifact_id: string;
  promoted_to_kb: boolean;
  synthesis: {
    synthesis_job_id?: string | null;
    page_ids: string[];
    pages_created: number;
    pages_updated: number;
    pages_skipped: number;
  };
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

const parseSseStream = async (
  response: Response,
  onEvent: (event: TaskStreamEvent) => void | Promise<void>,
) => {
  if (!response.body) throw new Error('Task stream did not return a body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const rawEvent of events) {
      const event = rawEvent.split('\n').find((line) => line.startsWith('event: '))?.slice(7) as TaskEventName | undefined;
      const data = rawEvent.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
      if (!event || !data) continue;
      await onEvent({ event, payload: JSON.parse(data) });
    }
  }
};

export const getTask = async (taskId: string): Promise<TaskState> => {
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`, {
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not load task.'));
  return response.json();
};

export const createTask = async (payload: {
  agentId: string;
  workflowId?: string | null;
  title?: string | null;
}): Promise<{ id: string }> => {
  const response = await fetch(`${getBaseUrl()}/api/tasks`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({
      agent_id: payload.agentId,
      workflow_id: payload.workflowId ?? null,
      origin: 'profile',
      title: payload.title ?? null,
    }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not create task.'));
  return response.json();
};

export const runTask = async (
  taskId: string,
  onEvent: (event: TaskStreamEvent) => void | Promise<void>,
) => {
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/run`, {
    method: 'POST',
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not run task.'));
  await parseSseStream(response, onEvent);
};

export const replyTask = async (taskId: string, message: string): Promise<TaskState> => {
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/messages`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not send reply.'));
  return response.json();
};

export const uploadTaskFile = async (taskId: string, filePath: string, content: string): Promise<TaskState> => {
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/files`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({ file_path: filePath, content }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not attach file.'));
  return response.json();
};

export const cancelTask = async (taskId: string): Promise<TaskState> => {
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not pause task.'));
  return response.json();
};

export const getTaskFile = async (taskId: string, filePath: string): Promise<WorkspaceFileContent> => {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/files/${encodedPath}`, {
    headers: await getAuthHeaders(false),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not load workspace file.'));
  return response.json();
};

export const promoteTaskArtifact = async (taskId: string, artifactId?: string | null): Promise<TaskPromotionResult> => {
  const response = await fetch(`${getBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/promote`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({ artifact_id: artifactId ?? null }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, 'Could not add artifact to Second Brain.'));
  return response.json();
};
