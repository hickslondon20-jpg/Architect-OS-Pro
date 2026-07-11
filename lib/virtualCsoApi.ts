import { supabase } from './supabaseClient';
import {
  INSIGHT_STARTERS,
  MOCK_SOURCE_PAGES,
  MOCK_SOURCE_REFS,
  SOURCE_KIND_LABELS,
  type Chat,
  type InsightStarter,
  type Message,
  type Project,
  type SourceKind,
  type SourcePage,
  type SourceRef,
  type AgentStep,
  type ArtifactDelivery,
} from './virtualCsoMockData';
import { getArtifact } from './artifactsApi';

export { INSIGHT_STARTERS, MOCK_SOURCE_REFS, SOURCE_KIND_LABELS };
export type { ArtifactDelivery, Chat, InsightStarter, Message, Project, SourceKind, SourcePage, SourceRef };

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

export interface SendUserMessageOptions {
  linkedFolder?: string | null;
  projectId?: string | null;
  onUserMessage?: (message: Message) => void;
  onToken?: (text: string) => void;
  onReady?: (meta: { threadId: string; route: Ws5RouteMeta; assembledContext: Ws5AssembledContextMeta; agentSteps?: AgentStep[] }) => void;
}

export interface SendUserMessageResult {
  chat: Chat;
  userMessage: Message;
  assistantMessage: Message;
  sources: SourceRef[];
  sourcePages: SourcePage[];
  route: Ws5RouteMeta | null;
  assembledContext: Ws5AssembledContextMeta | null;
}

const sourceRefsByChat = new Map<string, SourceRef[]>();
const sourcePagesById = new Map<string, SourcePage>(Object.entries(MOCK_SOURCE_PAGES));
const PYTHON_BACKEND_URL = import.meta.env.VITE_INGESTION_API_URL as string | undefined;

const backendApiUrl = (path: string) => {
  if (!PYTHON_BACKEND_URL) return path;
  const normalizedBaseUrl = /^https?:\/\//i.test(PYTHON_BACKEND_URL)
    ? PYTHON_BACKEND_URL
    : `https://${PYTHON_BACKEND_URL}`;
  return `${normalizedBaseUrl.replace(/\/$/, '')}${path}`;
};

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
  source_refs?: Array<Record<string, unknown>> | null;
};

type AgentDelegationRunWithSteps = {
  assistant_message_id?: string | null;
  agent_delegation_steps?: AgentDelegationStepRow[] | null;
  structured_result?: Record<string, unknown> | null;
};

const outputToString = (output: unknown): string => {
  if (typeof output === 'string') return output;
  if (output === null || output === undefined) return '';
  return JSON.stringify(output);
};

const toAgentStep = (step: AgentDelegationStepRow): AgentStep => ({
  tool: String(step.tool_name ?? step.title ?? step.step_type ?? ''),
  input: step.input_summary ?? {},
  output: outputToString(step.output_summary ?? step.summary ?? ''),
  status: step.status ?? undefined,
  sourceRefs: step.source_refs ?? undefined,
});

const toMessage = (row: any, agentSteps?: AgentStep[], artifactDeliveries?: ArtifactDelivery[]): Message => ({
  id: row.id,
  chatId: row.thread_id ?? row.chatId,
  role: row.role,
  content: row.content,
  createdAt: row.created_at ?? row.createdAt,
  agentSteps,
  artifactDeliveries,
});

const artifactIdFromRun = (run: AgentDelegationRunWithSteps): string | null => {
  const structuredId = run.structured_result?.artifact_id;
  if (typeof structuredId === 'string' && structuredId) return structuredId;
  for (const step of run.agent_delegation_steps ?? []) {
    for (const ref of step.source_refs ?? []) {
      const metadata = ref.metadata;
      if (metadata && typeof metadata === 'object') {
        const artifactId = (metadata as Record<string, unknown>).artifact_id;
        if (typeof artifactId === 'string' && artifactId) return artifactId;
      }
    }
  }
  return null;
};

const rememberSources = (chatId: string, sources: SourceRef[] = [], pages: SourcePage[] = []) => {
  sourceRefsByChat.set(chatId, sources);
  pages.forEach((page) => sourcePagesById.set(page.id, page));
};

const parseSseStream = async (
  response: Response,
  handlers: {
    onEvent: (event: string, payload: any) => void;
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
      handlers.onEvent(event, JSON.parse(data));
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
  const artifactIdsByMessageId = new Map<string, string>();
  const artifactsById = new Map<string, ArtifactDelivery>();

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
          .map(toAgentStep),
      ]);
      const artifactId = artifactIdFromRun(run);
      if (artifactId) artifactIdsByMessageId.set(run.assistant_message_id, artifactId);
    }

    await Promise.all(
      Array.from(new Set(artifactIdsByMessageId.values())).map(async (artifactId) => {
        try {
          artifactsById.set(artifactId, await getArtifact(artifactId));
        } catch {
          // A stale or unauthorized artifact should not prevent the chat thread from loading.
        }
      }),
    );
  }

  return messageRows.map((row) => {
    const artifactId = artifactIdsByMessageId.get(row.id);
    const artifact = artifactId ? artifactsById.get(artifactId) : undefined;
    return toMessage(row, stepsByMessageId.get(row.id), artifact ? [artifact] : undefined);
  });
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
  const response = await fetch(backendApiUrl('/api/vcso/chat'), {
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
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text().catch(() => 'Could not reach Virtual CSO stream.'));
  }

  let chat: Chat | null = null;
  let userMessage: Message | null = null;
  let assistantMessage: Message | null = null;
  let sources: SourceRef[] = [];
  let sourcePages: SourcePage[] = [];
  let route: Ws5RouteMeta | null = null;
  let assembledContext: Ws5AssembledContextMeta | null = null;
  let artifactId: string | null = null;
  let artifactDelivery: ArtifactDelivery | null = null;

  await parseSseStream(response, {
    onEvent: (event, payload) => {
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
      }
      if (event === 'token') {
        options.onToken?.(payload.text ?? '');
      }
      if (event === 'done') {
        chat = payload.chat;
        assistantMessage = toMessage(
          payload.assistantMessage,
          payload.assistantMessage?.agentSteps,
        );
        artifactId = typeof payload.artifactId === 'string' ? payload.artifactId : null;
        sources = payload.sources ?? [];
        sourcePages = payload.sourcePages ?? [];
        if (assistantMessage) rememberSources(assistantMessage.chatId, sources, sourcePages);
      }
      if (event === 'error') {
        throw new Error(payload.message ?? 'Virtual CSO stream failed.');
      }
    },
  });

  if (!chat || !userMessage || !assistantMessage) {
    throw new Error('Virtual CSO stream ended before the turn was saved.');
  }

  if (artifactId) {
    try {
      artifactDelivery = await getArtifact(artifactId);
      assistantMessage = { ...assistantMessage, artifactDeliveries: [artifactDelivery] };
    } catch {
      // A stale or unauthorized artifact should not hide the completed assistant answer.
    }
  }

  return { chat, userMessage, assistantMessage, sources, sourcePages, route, assembledContext };
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

export const getSourceRefsForChat = (chatId: string): SourceRef[] => sourceRefsByChat.get(chatId) ?? [];

export const getSourcePage = (pageId: string): SourcePage | undefined => sourcePagesById.get(pageId);
