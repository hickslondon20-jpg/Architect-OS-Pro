import { supabase } from './supabaseClient';
import {
  INSIGHT_STARTERS,
  CITATION_SOURCE_KIND_LABELS,
  MOCK_CITATION_REFS,
  MOCK_SOURCE_PAGES,
  type Chat,
  type CitationRef,
  type CitationSourceKind,
  type CitationVerdict,
  type InsightStarter,
  type Message,
  type Project,
  type SourcePage,
  type AgentStep,
} from './virtualCsoMockData';
import { getArtifact, type ArtifactDelivery } from './artifactsApi';
import type { DomainAgent, DomainTask, DomainWorkflow } from '../pages/ProSuite/domain-agents/types';

export { CITATION_SOURCE_KIND_LABELS, INSIGHT_STARTERS, MOCK_CITATION_REFS };
export type { AgentStep, Chat, CitationRef, CitationSourceKind, CitationVerdict, InsightStarter, Message, Project, SourcePage };

const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;
const USE_PYTHON_VCSO_STREAM = import.meta.env.VITE_VCSO_PYTHON_STREAM === 'true';

export interface VirtualCsoData {
  projects: Project[];
  chats: Chat[];
}

export interface Ws5RouteMeta {
  primaryPackSlug: string | null;
  rankedPackSlugs: string[];
  requiredPlatformContext: string[];
  confidence: number;
  reason: string;
}

export interface Ws5AssembledContextMeta {
  skillIndexCount: number;
  selectedPackSlugs: string[];
  loadedIpPageCount: number;
  founderIndexCount: number;
  loadedFounderPageTitles: string[];
  requiredPlatformContext: string[];
  allowDraftIp: boolean;
}

export type ContextRemainingBand = 'green' | 'amber' | 'red';

export interface ContextRemainingSignal {
  remainingPercent: number;
  band: ContextRemainingBand;
}

export interface AgentTaskHandle {
  schemaVersion: 'vcso_agent_task_v1';
  origin: 'vcso';
  request: string;
  freeformRequestId?: string | null;
  task: DomainTask;
  agent: DomainAgent;
  workflow?: DomainWorkflow | null;
  artifactId?: string | null;
}

export interface SendUserMessageOptions {
  linkedFolder?: string | null;
  projectId?: string | null;
  deepMode?: boolean;
  onUserMessage?: (message: Message) => void;
  onToken?: (text: string) => void;
  onReady?: (meta: { threadId: string; route: Ws5RouteMeta; assembledContext: Ws5AssembledContextMeta; agentSteps?: AgentStep[] }) => void;
  onTrace?: (steps: AgentStep[]) => void;
  onContext?: (signal: ContextRemainingSignal) => void;
  onTodosUpdated?: (todos: AgentTodo[]) => void;
  onWorkspaceUpdated?: () => void;
  onAskUser?: (question: string) => void;
  onAgentStatus?: (status: Chat['agentStatus']) => void;
  onAgentTask?: (task: AgentTaskHandle) => void;
}

export interface SendUserMessageResult {
  chat: Chat;
  userMessage: Message;
  assistantMessage: Message;
  sources: CitationRef[];
  sourcePages: SourcePage[];
  route: Ws5RouteMeta | null;
  assembledContext: Ws5AssembledContextMeta | null;
  contextSignal: ContextRemainingSignal | null;
}

export interface AgentTodo {
  id: string;
  threadId: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  position: number;
  updatedAt?: string | null;
}

export interface ThreadWorkspaceFile {
  id: string;
  filePath: string;
  source: string;
  size?: number | null;
  storagePath?: string | null;
  content?: string | null;
  updatedAt?: string | null;
}

const citationRefsByChat = new Map<string, CitationRef[]>(Object.entries(MOCK_CITATION_REFS));
const sourcePagesById = new Map<string, SourcePage>(Object.entries(MOCK_SOURCE_PAGES));

const requireUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('You must be signed in to use Virtual CSO.');
  return userId;
};

const requireAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('You must be signed in to use Virtual CSO.');
  return token;
};

const getBaseUrl = () => {
  if (!INGESTION_API_URL) throw new Error('Virtual CSO backend is not configured.');
  return INGESTION_API_URL.replace(/\/$/, '');
};

const formatDate = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

const toProject = (row: any): Project => ({
  id: row.id,
  name: row.name,
  pinnedContext: row.pinned_context ?? [],
});

const toChat = (row: any): Chat => ({
  id: row.id,
  title: row.title,
  projectId: row.project_id,
  pinned: row.pinned,
  agentStatus: row.agent_status ?? 'complete',
  lastMessageAt: formatDate(row.last_message_at),
});

type AgentDelegationStepRow = {
  step_index?: number | null;
  tool_name?: string | null;
  title?: string | null;
  step_type?: string | null;
  status?: string | null;
  input_summary?: Record<string, unknown> | null;
  output_summary?: unknown;
  summary?: string | null;
  source_refs?: Record<string, unknown>[] | null;
};

type AgentDelegationRunWithSteps = {
  assistant_message_id?: string | null;
  structured_result?: { artifact_id?: string | null; agent_task?: AgentTaskHandle | null } | null;
  agent_delegation_steps?: AgentDelegationStepRow[] | null;
};

const outputToString = (output: unknown): string => {
  if (typeof output === 'string') return output;
  if (output === null || output === undefined) return '';
  return JSON.stringify(output);
};

const isRenderableTraceStep = (step: AgentStep | AgentDelegationStepRow): boolean => {
  const stepType = 'stepType' in step ? step.stepType : step.step_type;
  return stepType !== 'context_build' && stepType !== 'result';
};

const toAgentStep = (step: AgentDelegationStepRow): AgentStep => ({
  stepIndex: step.step_index ?? undefined,
  stepType: step.step_type ?? undefined,
  title: step.title ?? undefined,
  summary: step.summary ?? undefined,
  sourceRefs: parseCitationRefs(step.source_refs),
  tool: String(step.tool_name ?? step.title ?? step.step_type ?? ''),
  input: step.input_summary ?? {},
  output: outputToString(step.output_summary ?? step.summary ?? ''),
  status: step.status ?? undefined,
});

const toMessage = (row: any, agentSteps?: AgentStep[], artifactDeliveries?: ArtifactDelivery[], agentTasks?: AgentTaskHandle[]): Message => ({
  id: row.id,
  chatId: row.thread_id ?? row.chatId,
  role: row.role,
  content: row.content,
  createdAt: row.created_at ?? row.createdAt,
  deepMode: Boolean(row.deep_mode ?? row.deepMode),
  agentSteps,
  citations: parseCitationRefs(row.citations),
  artifactDeliveries,
  agentTasks,
});

const toAgentTodo = (row: any): AgentTodo => ({
  id: row.id,
  threadId: row.thread_id,
  content: row.content,
  status: row.status ?? 'pending',
  position: row.position ?? 0,
  updatedAt: row.updated_at ?? null,
});

const toThreadWorkspaceFile = (row: any): ThreadWorkspaceFile => ({
  id: row.id,
  filePath: row.file_path,
  source: row.source,
  size: row.size ?? null,
  storagePath: row.storage_path ?? null,
  content: row.content ?? null,
  updatedAt: row.updated_at ?? null,
});

const rememberSources = (chatId: string, sources: CitationRef[] = [], pages: SourcePage[] = []) => {
  citationRefsByChat.set(chatId, sources);
  pages.forEach((page) => sourcePagesById.set(page.id, page));
};

const parseCitationRefs = (value: unknown): CitationRef[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CitationRef => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Partial<CitationRef>;
    return typeof candidate.source_kind === 'string' && typeof candidate.source_metadata === 'object';
  });
};

const parseSseStream = async (
  response: Response,
  handlers: {
    onEvent: (event: string, payload: any) => void | Promise<void>;
  },
) => {
  if (!response.body) throw new Error('WS5 stream did not return a body.');
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
      const event = rawEvent.split('\n').find((line) => line.startsWith('event: '))?.slice(7) ?? 'message';
      const data = rawEvent.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
      if (!data) continue;
      await handlers.onEvent(event, JSON.parse(data));
    }
  }
};

export const loadVirtualCsoData = async (): Promise<VirtualCsoData> => {
  await requireUserId();
  const [projectsResult, chatsResult] = await Promise.all([
    supabase.from('vcso_projects').select('*').order('created_at', { ascending: true }),
    supabase.from('vcso_chat_threads').select('*').order('last_message_at', { ascending: false }),
  ]);

  if (projectsResult.error) throw projectsResult.error;
  if (chatsResult.error) throw chatsResult.error;

  return {
    projects: (projectsResult.data ?? []).map(toProject),
    chats: (chatsResult.data ?? []).map(toChat),
  };
};

export const getChatById = (chats: Chat[], id: string): Chat | undefined => chats.find((c) => c.id === id);

export const getProjectById = (projects: Project[], id: string): Project | undefined =>
  projects.find((p) => p.id === id);

export const getChatsForProject = (chats: Chat[], projectId: string): Chat[] =>
  chats.filter((c) => c.projectId === projectId);

export const getPinnedChats = (chats: Chat[]): Chat[] => chats.filter((c) => c.pinned);

export const getRecentChats = (chats: Chat[]): Chat[] =>
  [...chats].sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

export const getMessagesForChat = async (chatId: string): Promise<Message[]> => {
  const userId = await requireUserId();
  const result = await supabase
    .from('vcso_chat_messages')
    .select('*')
    .eq('thread_id', chatId)
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;

  const messageRows = result.data ?? [];
  const assistantMessageIds = messageRows
    .filter((row) => row.role === 'assistant')
    .map((row) => row.id);
  const stepsByMessageId = new Map<string, AgentStep[]>();
  const artifactIdsByMessageId = new Map<string, string[]>();
  const agentTasksByMessageId = new Map<string, AgentTaskHandle[]>();

  if (assistantMessageIds.length > 0) {
    const runsResult = await supabase
      .from('agent_delegation_runs')
      .select('assistant_message_id,structured_result,agent_delegation_steps(step_index,tool_name,title,step_type,status,input_summary,output_summary,summary,source_refs)')
      .eq('user_id', userId)
      .in('assistant_message_id', assistantMessageIds);
    if (runsResult.error) throw runsResult.error;

    for (const run of (runsResult.data ?? []) as AgentDelegationRunWithSteps[]) {
      if (!run.assistant_message_id) continue;
      const existing = stepsByMessageId.get(run.assistant_message_id) ?? [];
      stepsByMessageId.set(run.assistant_message_id, [
        ...existing,
        ...(run.agent_delegation_steps ?? [])
          .sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0))
          .map(toAgentStep)
          .filter(isRenderableTraceStep),
      ]);
      const artifactId = run.structured_result?.artifact_id;
      if (artifactId) {
        const existingArtifactIds = artifactIdsByMessageId.get(run.assistant_message_id) ?? [];
        artifactIdsByMessageId.set(run.assistant_message_id, [...existingArtifactIds, artifactId]);
      }
      const agentTask = run.structured_result?.agent_task;
      if (agentTask) {
        const existingAgentTasks = agentTasksByMessageId.get(run.assistant_message_id) ?? [];
        agentTasksByMessageId.set(run.assistant_message_id, [...existingAgentTasks, agentTask]);
      }
    }
  }

  const artifactsByMessageId = new Map<string, ArtifactDelivery[]>();
  await Promise.all(
    Array.from(artifactIdsByMessageId.entries()).map(async ([messageId, artifactIds]) => {
      const artifacts = (
        await Promise.all(
          Array.from(new Set(artifactIds)).map((artifactId) =>
            getArtifact(artifactId).catch(() => null),
          ),
        )
      ).filter((artifact): artifact is ArtifactDelivery => Boolean(artifact));
      if (artifacts.length > 0) artifactsByMessageId.set(messageId, artifacts);
    }),
  );

  return messageRows.map((row) => toMessage(row, stepsByMessageId.get(row.id), artifactsByMessageId.get(row.id), agentTasksByMessageId.get(row.id)));
};

export const createProject = async (name: string): Promise<Project> => {
  const userId = await requireUserId();
  const result = await supabase
    .from('vcso_projects')
    .insert({ user_id: userId, name })
    .select('*')
    .single();
  if (result.error) throw result.error;
  return toProject(result.data);
};

export const deleteProject = async (projectId: string) => {
  const result = await supabase.from('vcso_projects').delete().eq('id', projectId);
  if (result.error) throw result.error;
};

export const createThread = async (title = 'New conversation', projectId?: string | null): Promise<Chat> => {
  const userId = await requireUserId();
  const result = await supabase
    .from('vcso_chat_threads')
    .insert({ user_id: userId, title, project_id: projectId ?? null })
    .select('*')
    .single();
  if (result.error) throw result.error;
  return toChat(result.data);
};

export const renameThread = async (threadId: string, title: string) => {
  const result = await supabase.from('vcso_chat_threads').update({ title }).eq('id', threadId);
  if (result.error) throw result.error;
};

export const deleteThread = async (threadId: string) => {
  const result = await supabase.from('vcso_chat_threads').delete().eq('id', threadId);
  if (result.error) throw result.error;
};

export const setThreadPinned = async (threadId: string, pinned: boolean) => {
  const result = await supabase.from('vcso_chat_threads').update({ pinned }).eq('id', threadId);
  if (result.error) throw result.error;
};

export const sendUserMessage = async (
  threadId: string | null,
  text: string,
  options: SendUserMessageOptions = {},
): Promise<SendUserMessageResult> => {
  const token = await requireAccessToken();
  const endpoint = USE_PYTHON_VCSO_STREAM ? `${getBaseUrl()}/api/vcso/chat` : '/api/vcso/chat';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      threadId,
      text,
      linkedFolder: options.linkedFolder ?? null,
      projectId: options.projectId ?? null,
      deepMode: Boolean(options.deepMode),
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text().catch(() => 'Could not reach Virtual CSO stream.'));
  }

  let chat: Chat | null = null;
  let userMessage: Message | null = null;
  let assistantMessage: Message | null = null;
  let sources: CitationRef[] = [];
  let sourcePages: SourcePage[] = [];
  let route: Ws5RouteMeta | null = null;
  let assembledContext: Ws5AssembledContextMeta | null = null;
  let contextSignal: ContextRemainingSignal | null = null;
  const liveTrace: AgentStep[] = [];
  const liveAgentTasks: AgentTaskHandle[] = [];

  await parseSseStream(response, {
    onEvent: async (event, payload) => {
      if (event === 'ready') {
        userMessage = toMessage(payload.userMessage);
        route = payload.route;
        assembledContext = payload.assembledContext;
        options.onUserMessage?.(userMessage);
        options.onReady?.({
          threadId: payload.threadId,
          route,
          assembledContext,
          agentSteps: payload.agentSteps ?? undefined,
        });
        options.onAgentStatus?.(payload.agentStatus ?? (options.deepMode ? 'working' : 'complete'));
      }
      if (event === 'token') {
        options.onToken?.(payload.text ?? '');
      }
      if (event === 'step') {
        return;
      }
      if (event === 'tool_call') {
        const step: AgentStep = {
          stepIndex: Number.isFinite(Number(payload.stepIndex)) ? Number(payload.stepIndex) : undefined,
          stepType: String(payload.stepType ?? 'tool_call'),
          title: payload.title ? String(payload.title) : undefined,
          summary: payload.summary ? String(payload.summary) : undefined,
          sourceRefs: parseCitationRefs(payload.sourceRefs),
          tool: String(payload.tool ?? 'tool'),
          input: payload.input ?? {},
          output: String(payload.summary ?? ''),
          status: payload.status ?? 'running',
        };
        liveTrace.push(step);
        options.onTrace?.([...liveTrace]);
      }
      if (event === 'tool_result') {
        const step: AgentStep = {
          stepIndex: Number.isFinite(Number(payload.stepIndex)) ? Number(payload.stepIndex) : undefined,
          stepType: String(payload.stepType ?? 'tool_call'),
          title: payload.title ? String(payload.title) : undefined,
          summary: payload.summary ? String(payload.summary) : undefined,
          sourceRefs: parseCitationRefs(payload.sourceRefs),
          tool: String(payload.tool ?? 'tool'),
          input: {},
          output: String(payload.output ?? payload.summary ?? ''),
          status: payload.status ?? 'completed',
        };
        const runningIndex = [...liveTrace]
          .reverse()
          .findIndex((item) => item.tool === step.tool && item.status === 'running');
        if (runningIndex >= 0) {
          liveTrace[liveTrace.length - 1 - runningIndex] = {
            ...liveTrace[liveTrace.length - 1 - runningIndex],
            stepIndex: step.stepIndex ?? liveTrace[liveTrace.length - 1 - runningIndex].stepIndex,
            stepType: step.stepType ?? liveTrace[liveTrace.length - 1 - runningIndex].stepType,
            title: step.title ?? liveTrace[liveTrace.length - 1 - runningIndex].title,
            summary: step.summary ?? liveTrace[liveTrace.length - 1 - runningIndex].summary,
            sourceRefs: step.sourceRefs ?? liveTrace[liveTrace.length - 1 - runningIndex].sourceRefs,
            output: step.output,
            status: step.status,
          };
        } else {
          liveTrace.push(step);
        }
        options.onTrace?.([...liveTrace]);
      }
      if (event === 'context') {
        const remainingPercent = Number(payload.remainingPercent);
        if (Number.isFinite(remainingPercent)) {
          const band = payload.band === 'red' || payload.band === 'amber' ? payload.band : 'green';
          contextSignal = {
            remainingPercent: Math.max(0, Math.min(100, Math.round(remainingPercent))),
            band,
          };
          options.onContext?.(contextSignal);
        }
      }
      if (event === 'todos_updated') {
        const rows = Array.isArray(payload.todos) ? payload.todos.map(toAgentTodo) : [];
        options.onTodosUpdated?.(rows);
      }
      if (event === 'workspace_updated') {
        options.onWorkspaceUpdated?.();
      }
      if (event === 'agent_task') {
        liveAgentTasks.push(payload as AgentTaskHandle);
        options.onAgentTask?.(payload as AgentTaskHandle);
      }
      if (event === 'ask_user') {
        options.onAskUser?.(String(payload.question ?? ''));
        options.onAgentStatus?.('waiting_for_user');
      }
      if (event === 'done_waiting') {
        chat = payload.chat;
        assistantMessage = {
          id: `waiting-${payload.chat?.id ?? Date.now()}`,
          chatId: payload.chat?.id ?? userMessage?.chatId ?? '',
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
          deepMode: true,
        };
        options.onAgentStatus?.('waiting_for_user');
      }
      if (event === 'done') {
        chat = payload.chat;
        const artifact = payload.artifactId ? await getArtifact(payload.artifactId).catch(() => null) : null;
        const completedSteps = payload.assistantMessage?.agentSteps?.length
          ? payload.assistantMessage.agentSteps.filter(isRenderableTraceStep)
          : liveTrace;
        assistantMessage = toMessage(
          payload.assistantMessage,
          completedSteps,
          artifact ? [artifact] : undefined,
          payload.assistantMessage?.agentTasks ?? liveAgentTasks,
        );
        sources = parseCitationRefs(payload.sources);
        sourcePages = payload.sourcePages ?? [];
        if (assistantMessage) rememberSources(assistantMessage.chatId, sources, sourcePages);
        options.onAgentStatus?.(payload.agentStatus ?? 'complete');
      }
      if (event === 'error') {
        throw new Error(payload.message ?? 'Virtual CSO stream failed.');
      }
    },
  });

  if (!chat || !userMessage || !assistantMessage) {
    throw new Error('Virtual CSO stream ended before the turn was saved.');
  }

  return { chat, userMessage, assistantMessage, sources, sourcePages, route, assembledContext, contextSignal };
};

export const requestThreadCompaction = async (threadId: string): Promise<{
  compacted: boolean;
  message?: string | null;
  remainingPercent?: number | null;
  band?: ContextRemainingBand | null;
}> => {
  const token = await requireAccessToken();
  const response = await fetch(`${getBaseUrl()}/api/vcso/compact`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ threadId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail ?? payload.error ?? 'Could not compact this thread.');
  return payload;
};

export const getThreadTodos = async (threadId: string): Promise<AgentTodo[]> => {
  await requireUserId();
  const result = await supabase
    .from('agent_todos')
    .select('*')
    .eq('thread_id', threadId)
    .order('position', { ascending: true });
  if (result.error) throw result.error;
  return (result.data ?? []).map(toAgentTodo);
};

export const saveThreadTodos = async (threadId: string, todos: AgentTodo[]): Promise<AgentTodo[]> => {
  const userId = await requireUserId();
  const rows = todos.map((todo, index) => ({
    thread_id: threadId,
    user_id: userId,
    content: todo.content,
    status: todo.status,
    position: index,
  }));
  const deleteResult = await supabase.from('agent_todos').delete().eq('thread_id', threadId);
  if (deleteResult.error) throw deleteResult.error;
  if (rows.length === 0) return [];
  const insertResult = await supabase.from('agent_todos').insert(rows).select('*');
  if (insertResult.error) throw insertResult.error;
  return (insertResult.data ?? []).map(toAgentTodo).sort((a, b) => a.position - b.position);
};

export const getThreadWorkspaceFiles = async (threadId: string): Promise<ThreadWorkspaceFile[]> => {
  await requireUserId();
  const result = await supabase
    .from('workspace_files')
    .select('id,file_path,source,size,storage_path,content,updated_at')
    .eq('owner_type', 'thread')
    .eq('owner_id', threadId)
    .order('file_path', { ascending: true });
  if (result.error) throw result.error;
  return (result.data ?? []).map(toThreadWorkspaceFile);
};

export const requestThreadWriteback = async (threadId: string): Promise<{ webhookPosted: boolean }> => {
  const token = await requireAccessToken();
  const response = await fetch('/api/vcso/writeback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ threadId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? 'Could not trigger writeback.');
  return { webhookPosted: Boolean(payload.webhookPosted) };
};

export type CitationResolveView =
  | {
      type: 'chunk';
      source_kind: 'document_chunk';
      source_id?: string | null;
      label?: string | null;
      verbatim?: string | null;
      locator?: Record<string, unknown> | null;
      document?: Record<string, unknown> | null;
      chunk?: Record<string, unknown> | null;
    }
  | {
      type: 'wiki';
      source_kind: 'wiki_page';
      source_id?: string | null;
      label?: string | null;
      wiki_kind?: string | null;
      tier?: string | null;
      summary?: string | null;
      prose?: string | null;
      claim?: Record<string, unknown> | null;
      page?: Record<string, unknown> | null;
      evidence?: Record<string, unknown>[];
      locator?: Record<string, unknown> | null;
    }
  | {
      type: 'platform_record';
      source_kind: 'platform_record';
      source_id?: string | null;
      label?: string | null;
      table?: string | null;
      row_id?: string | null;
      field?: string | null;
      fields?: { key: string; label: string; value: unknown }[];
      deep_link?: string | null;
      record?: Record<string, unknown> | null;
    }
  | {
      type: 'web_dark' | 'not_citable' | 'error';
      source_kind?: string | null;
      source_id?: string | null;
      label?: string | null;
      code?: string | null;
      message?: string | null;
      snapshot?: Record<string, unknown> | null;
      trace?: Record<string, unknown> | null;
    };

export interface CitationResolveResult {
  status: 'ok' | 'error';
  view: CitationResolveView;
}

export interface CitationCheckResult {
  status: 'ok' | 'error';
  overall: CitationVerdict;
  summary: string;
  verdicts: NonNullable<CitationRef['verdict']>[];
  model: string;
}

export const resolveCitation = async (ref: CitationRef): Promise<CitationResolveResult> => {
  if (ref.source_kind === 'derived') {
    return {
      status: 'ok',
      view: {
        type: 'not_citable',
        source_kind: 'derived',
        source_id: ref.source_id,
        code: 'trace_only',
        message: 'Derived refs are trace-only.',
      },
    };
  }
  const token = await requireAccessToken();
  const response = await fetch(`${getBaseUrl()}/api/citations/resolve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ref }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      status: 'error',
      view: {
        type: 'error',
        source_kind: ref.source_kind,
        source_id: ref.source_id,
        code: 'unresolvable',
        message: payload?.detail ?? 'Source unavailable.',
      },
    };
  }
  return payload as CitationResolveResult;
};

export const getDocumentSignedUrl = async (documentId: string): Promise<string> => {
  const token = await requireAccessToken();
  const response = await fetch(`${getBaseUrl()}/api/documents/${documentId}/signed-url`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.detail ?? 'Could not open source PDF.');
  if (typeof payload.signed_url !== 'string' || !payload.signed_url) {
    throw new Error('Source PDF URL was not returned.');
  }
  return payload.signed_url;
};

export const checkMessageCitations = async (messageId: string): Promise<CitationCheckResult> => {
  const token = await requireAccessToken();
  const response = await fetch(`${getBaseUrl()}/api/citations/check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message_id: messageId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.detail ?? 'Could not check citations.');
  return payload as CitationCheckResult;
};

export const getCitationRefsForChat = (chatId: string): CitationRef[] => citationRefsByChat.get(chatId) ?? [];

export const getSourcePage = (pageId: string): SourcePage | undefined => sourcePagesById.get(pageId);
