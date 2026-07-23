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
  type AgentActivityItem,
  type AgentTodo,
  type ArtifactDelivery,
} from './virtualCsoMockData';
import { getArtifact } from './artifactsApi';

export { INSIGHT_STARTERS, MOCK_SOURCE_REFS, SOURCE_KIND_LABELS };
export type { AgentActivityItem, AgentStep, AgentTodo, ArtifactDelivery, Chat, InsightStarter, Message, Project, SourceKind, SourcePage, SourceRef };

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
  onToken?: (text: string, meta: { channel: 'answer' | 'narration'; sdkMode: boolean }) => void;
  onActivity?: (items: AgentActivityItem[]) => void;
  onAgentSteps?: (steps: AgentStep[]) => void;
  onPlanUpdate?: (todos: AgentTodo[]) => void;
  onSourcesUpdate?: (sources: SourceRef[]) => void;
  onReady?: (meta: { threadId: string; route: Ws5RouteMeta; assembledContext: Ws5AssembledContextMeta; agentSteps?: AgentStep[]; sdkMode: boolean }) => void;
}

export interface SendUserMessageResult {
  chat: Chat;
  userMessage: Message;
  assistantMessage: Message;
  sources: SourceRef[];
  sourcePages: SourcePage[];
  route: Ws5RouteMeta | null;
  assembledContext: Ws5AssembledContextMeta | null;
  sdkMode: boolean;
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
  id?: string | null;
  assistant_message_id?: string | null;
  capability_key?: string | null;
  status?: string | null;
  result_summary?: string | null;
  citations?: Array<Record<string, unknown>> | null;
  agent_delegation_steps?: AgentDelegationStepRow[] | null;
  structured_result?: Record<string, unknown> | null;
};

const outputToString = (output: unknown): string => {
  if (typeof output === 'string') return output;
  if (output === null || output === undefined) return '';
  return JSON.stringify(output);
};

const childRunIdFromOutput = (output: unknown): string | null => {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return null;
  const runId = (output as Record<string, unknown>).run_id;
  return typeof runId === 'string' && runId ? runId : null;
};

const sourceKindForWorkerRef = (source: Record<string, unknown>): SourceKind => {
  const rawKind = String(source.kind ?? source.source_kind ?? '').toLowerCase();
  if (['wiki', 'wiki_page', 'wiki_claim', 'wiki_evidence', 'per_user_wiki'].includes(rawKind)) return 'wiki';
  if (['ip', 'global_ip', 'architect_os_ip'].includes(rawKind)) return 'ip';
  if (
    ['platform', 'founder_dataset', 'founder_dataset_row', 'structured_data', 'computation'].includes(rawKind)
  ) {
    return 'platform';
  }
  return 'context';
};

export const normalizeWorkerSourceRefs = (
  refs: Array<Record<string, unknown>> = [],
): SourceRef[] =>
  refs
    .map((source) => {
      const rawLabel = source.label
        ?? source.source_label
        ?? source.title
        ?? source.source_title
        ?? source.resource_label;
      if (typeof rawLabel !== 'string' || !rawLabel.trim()) return null;
      const kind = sourceKindForWorkerRef(source);
      const rawPageId = source.pageId ?? source.page_id ?? (kind === 'wiki' ? source.source_id : undefined);
      return {
        kind,
        label: rawLabel.trim().slice(0, 160),
        pageId: typeof rawPageId === 'string' && rawPageId ? rawPageId : undefined,
      };
    })
    .filter((source): source is SourceRef => Boolean(source));

/**
 * The `done` payload carries the persisted flat SDK trace, while the live stream carries the richer
 * C2 child hierarchy. Completion must not replace the hierarchy the founder just watched with the
 * older flat trace. Persisted steps still win for ordinary turns and as a fallback when no nested
 * worker detail arrived.
 */
export const preserveNestedAgentSteps = (
  liveSteps: AgentStep[],
  persistedSteps: AgentStep[] = [],
): AgentStep[] =>
  liveSteps.some((step) => (step.children?.length ?? 0) > 0)
    ? liveSteps
    : persistedSteps;

export interface NestedWorkerGroup {
  parentToolUseId: string;
  capabilityKey?: string;
  title: string;
  summary?: string;
  status: 'running' | 'completed' | 'failed';
  steps: AgentStep[];
  sources: SourceRef[];
}

const workerStatus = (status?: string): NestedWorkerGroup['status'] => {
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'completed';
  return 'running';
};

export const buildNestedWorkerGroups = (steps: AgentStep[]): NestedWorkerGroup[] => {
  const groups = new Map<string, NestedWorkerGroup>();
  steps
    .filter((step) => step.stepType === 'sub_agent' && step.parentToolUseId)
    .forEach((step) => {
      const parentToolUseId = step.parentToolUseId as string;
      const childSteps = step.children ?? [];
      const sourceMap = new Map<string, SourceRef>();
      normalizeWorkerSourceRefs([
        ...(step.sourceRefs ?? []),
        ...childSteps.flatMap((child) => child.sourceRefs ?? []),
      ]).forEach((source) => sourceMap.set(`${source.kind}:${source.label}`, source));
      const existing = groups.get(parentToolUseId);
      groups.set(parentToolUseId, {
        parentToolUseId,
        capabilityKey: step.subAgent?.capabilityKey ?? existing?.capabilityKey,
        title: step.title ?? existing?.title ?? 'Delegated analysis',
        summary: step.subAgent?.summary ?? step.summary ?? existing?.summary,
        status: workerStatus(step.subAgent?.status ?? step.status),
        steps: [...(existing?.steps ?? []), ...childSteps],
        sources: [...(existing?.sources ?? []), ...sourceMap.values()],
      });
    });
  return [...groups.values()];
};

export const applySubAgentStepEvent = (
  parent: AgentStep | undefined,
  payload: Record<string, any>,
): { parent: AgentStep | null; sources: SourceRef[] } => {
  if (!parent) return { parent: null, sources: [] };
  const rawStep = payload.step && typeof payload.step === 'object'
    ? payload.step as Record<string, any>
    : {};
  const parentToolUseId = String(payload.parentToolUseId ?? parent.parentToolUseId ?? '');
  const rawSourceRefs = Array.isArray(rawStep.source_refs)
    ? rawStep.source_refs.filter((ref: unknown): ref is Record<string, unknown> =>
        Boolean(ref) && typeof ref === 'object' && !Array.isArray(ref))
    : [];
  const childStep: AgentStep = {
    stepIndex: typeof rawStep.step_index === 'number' ? rawStep.step_index : undefined,
    stepType: typeof rawStep.step_type === 'string' ? rawStep.step_type : 'sub_agent',
    title: String(rawStep.title ?? payload.title ?? 'Worker update').slice(0, 160),
    summary: typeof (rawStep.summary ?? payload.summary) === 'string'
      ? String(rawStep.summary ?? payload.summary).slice(0, 500)
      : undefined,
    tool: String(rawStep.tool_name ?? rawStep.title ?? payload.title ?? 'Worker update').slice(0, 160),
    // Curated-only contract: child drill-down never receives raw input/output payloads.
    input: {},
    output: '',
    status: workerStatus(rawStep.status ?? payload.status),
    parentToolUseId,
    sourceRefs: rawSourceRefs,
  };
  const children = [...(parent.children ?? [])];
  const existingIndex = children.findIndex((step) =>
    step.parentToolUseId === parentToolUseId
    && step.stepIndex !== undefined
    && step.stepIndex === childStep.stepIndex);
  if (existingIndex >= 0) children[existingIndex] = childStep;
  else children.push(childStep);
  children.sort((a, b) =>
    (a.stepIndex ?? Number.MAX_SAFE_INTEGER) - (b.stepIndex ?? Number.MAX_SAFE_INTEGER));
  const status = workerStatus(payload.status ?? parent.subAgent?.status ?? parent.status);
  return {
    parent: {
      ...parent,
      parentToolUseId,
      children,
      subAgent: {
        runId: payload.runId ?? parent.subAgent?.runId,
        capabilityKey: payload.capabilityKey ?? parent.subAgent?.capabilityKey,
        status,
        summary: typeof payload.summary === 'string'
          ? payload.summary.slice(0, 500)
          : parent.subAgent?.summary,
      },
    },
    sources: normalizeWorkerSourceRefs(rawSourceRefs),
  };
};

const toAgentStep = (step: AgentDelegationStepRow, childRun?: AgentDelegationRunWithSteps): AgentStep => {
  const output = step.output_summary && typeof step.output_summary === 'object' && !Array.isArray(step.output_summary)
    ? step.output_summary as Record<string, unknown>
    : {};
  const isSubAgent = step.tool_name === 'delegate_to_sub_agent' || step.tool_name === 'Task';
  const sourceRefs = [
    ...(step.source_refs ?? []),
    ...(childRun?.citations ?? []),
  ];
  return {
    stepIndex: step.step_index ?? undefined,
    stepType: isSubAgent ? 'sub_agent' : step.step_type ?? undefined,
    title: step.title ?? undefined,
    summary: step.summary ?? undefined,
    tool: String(step.tool_name ?? step.title ?? step.step_type ?? ''),
    input: {},
    output: '',
    status: step.status ?? undefined,
    parentToolUseId: typeof output.parent_tool_use_id === 'string'
      ? output.parent_tool_use_id
      : childRun?.id
        ? `persisted:${childRun.id}`
        : undefined,
    sourceRefs,
    children: childRun?.agent_delegation_steps
      ?.sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0))
      .map((childStep) => toAgentStep(childStep)),
    subAgent: childRun
      ? {
          runId: childRun.id ?? undefined,
          capabilityKey: childRun.capability_key ?? undefined,
          status: childRun.status ?? undefined,
          summary: childRun.result_summary ?? undefined,
        }
      : isSubAgent
        ? {
            runId: childRunIdFromOutput(step.output_summary) ?? undefined,
            capabilityKey: typeof output.capability_key === 'string' ? output.capability_key : undefined,
            status: typeof output.status === 'string' ? output.status : step.status ?? undefined,
            summary: typeof output.result_summary === 'string' ? output.result_summary : step.summary ?? undefined,
          }
        : undefined,
  };
};

const toMessage = (
  row: any,
  agentSteps?: AgentStep[],
  artifactDeliveries?: ArtifactDelivery[],
  surfaceMode?: 'sdk',
  activityItems?: AgentActivityItem[],
): Message => ({
  id: row.id,
  chatId: row.thread_id ?? row.chatId,
  role: row.role,
  content: row.content,
  createdAt: row.created_at ?? row.createdAt,
  agentSteps,
  activityItems,
  surfaceMode,
  artifactDeliveries,
});

const persistedNarrationSegments = (run?: AgentDelegationRunWithSteps): Array<{ segmentId: number; text: string }> => {
  const segments = run?.structured_result?.narration_segments;
  if (!Array.isArray(segments)) return [];
  return segments
    .map((segment, index) => {
      if (!segment || typeof segment !== 'object') return null;
      const record = segment as Record<string, unknown>;
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      const segmentId = typeof record.segmentId === 'number' ? record.segmentId : index + 1;
      return text ? { segmentId, text } : null;
    })
    .filter((segment): segment is { segmentId: number; text: string } => Boolean(segment));
};

const activityItemsFromSteps = (
  steps: AgentStep[] = [],
  narrationSegments: Array<{ segmentId: number; text: string }> = [],
): AgentActivityItem[] => {
  const orderedSteps = steps.filter((step) => typeof step.stepIndex === 'number');
  const toolSteps = orderedSteps.filter((step) =>
    ['tool_call', 'source_review', 'sub_agent', 'code_execution'].includes(step.stepType ?? ''),
  );
  const narrationBeforeStep = new Map<number, Array<{ segmentId: number; text: string }>>();
  narrationSegments.forEach((segment, index) => {
    const target = toolSteps[Math.min(index, Math.max(toolSteps.length - 1, 0))];
    if (!target || typeof target.stepIndex !== 'number') return;
    const current = narrationBeforeStep.get(target.stepIndex) ?? [];
    narrationBeforeStep.set(target.stepIndex, [...current, segment]);
  });

  const items: AgentActivityItem[] = [];
  let order = 0;
  orderedSteps.forEach((step) => {
    const stepIndex = step.stepIndex as number;
    for (const segment of narrationBeforeStep.get(stepIndex) ?? []) {
      items.push({
        id: `narration-${segment.segmentId}`,
        type: 'narration',
        order: order++,
        text: segment.text,
      });
    }
    items.push({ id: `step-${stepIndex}`, type: 'step', order: order++, stepIndex });
  });
  return items;
};

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
  const childRunsById = new Map<string, AgentDelegationRunWithSteps>();
  const sdkMessageIds = new Set<string>();
  const runsByMessageId = new Map<string, AgentDelegationRunWithSteps>();

  if (assistantMessageIds.length > 0) {
    const runsResult = await supabase
      .from('agent_delegation_runs')
      .select('assistant_message_id,structured_result,agent_delegation_steps(step_index,tool_name,title,step_type,status,input_summary,output_summary,summary,source_refs)')
      .eq('user_id', userId)
      .in('assistant_message_id', assistantMessageIds);
    if (runsResult.error) throw runsResult.error;

    const childRunIds = Array.from(
      new Set(
        ((runsResult.data ?? []) as AgentDelegationRunWithSteps[])
          .flatMap((run) => run.agent_delegation_steps ?? [])
          .map((step) => childRunIdFromOutput(step.output_summary))
          .filter((runId): runId is string => Boolean(runId)),
      ),
    );
    if (childRunIds.length > 0) {
      const childRunsResult = await supabase
        .from('agent_delegation_runs')
        .select('id,capability_key,status,result_summary,citations,agent_delegation_steps(step_index,tool_name,title,step_type,status,input_summary,output_summary,summary,source_refs)')
        .eq('user_id', userId)
        .in('id', childRunIds);
      if (childRunsResult.error) throw childRunsResult.error;
      for (const childRun of (childRunsResult.data ?? []) as AgentDelegationRunWithSteps[]) {
        if (childRun.id) childRunsById.set(childRun.id, childRun);
      }
    }

    for (const run of (runsResult.data ?? []) as AgentDelegationRunWithSteps[]) {
      if (!run.assistant_message_id) continue;
      runsByMessageId.set(run.assistant_message_id, run);
      if (
        run.structured_result?.schema_version === 'vcso_sdk_standard_v1'
        || run.structured_result?.schema_version === 'vcso_sdk_native_subagents_v1'
      ) {
        sdkMessageIds.add(run.assistant_message_id);
      }
      const existing = stepsByMessageId.get(run.assistant_message_id) ?? [];
      stepsByMessageId.set(run.assistant_message_id, [
        ...existing,
        ...(run.agent_delegation_steps ?? [])
          .sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0))
          .map((step) => {
            const childRunId = childRunIdFromOutput(step.output_summary);
            return toAgentStep(step, childRunId ? childRunsById.get(childRunId) : undefined);
          }),
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

  const messages = messageRows.map((row) => {
    const artifactId = artifactIdsByMessageId.get(row.id);
    const artifact = artifactId ? artifactsById.get(artifactId) : undefined;
    const steps = stepsByMessageId.get(row.id);
    const isSdkMessage = sdkMessageIds.has(row.id);
    return toMessage(
      row,
      steps,
      artifact ? [artifact] : undefined,
      isSdkMessage ? 'sdk' : undefined,
      isSdkMessage
        ? activityItemsFromSteps(
            steps,
            persistedNarrationSegments(runsByMessageId.get(row.id)),
          )
        : undefined,
    );
  });
  const latestAssistantWithSources = [...messageRows]
    .reverse()
    .find((row) => row.role === 'assistant' && Array.isArray(row.citations) && row.citations.length > 0);
  if (latestAssistantWithSources) {
    rememberSources(chatId, normalizeWorkerSourceRefs(latestAssistantWithSources.citations));
  }
  return messages;
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

/**
 * Defect 8 recovery: pick the persisted assistant reply for a turn whose SSE stream died.
 *
 * The stream is a delivery channel, not the record. When it dies the backend usually finishes anyway —
 * on the 04B-D2 run-4 canary the answer was written with 33 citations 140ms before the run completed,
 * while the founder was told the turn "was not saved".
 *
 * The one thing this must never do is hand back an OLDER answer from earlier in the thread and pass it
 * off as the reply to the message just sent. Hence the timestamp guard: with no user message to compare
 * against there is no way to tell this turn's answer from the previous one, so recover nothing.
 * Exported for tests.
 */
export const selectRecoverableAssistantMessage = (
  persisted: Message[],
  sentUserMessage: Message | null,
): Message | null => {
  if (!sentUserMessage) return null;
  const sentAt = new Date(sentUserMessage.createdAt).getTime();
  if (Number.isNaN(sentAt)) return null;
  const newestFirst = [...persisted].reverse();
  const candidate = newestFirst.find((message) => message.role === 'assistant');
  if (!candidate) return null;
  const candidateAt = new Date(candidate.createdAt).getTime();
  if (Number.isNaN(candidateAt) || candidateAt < sentAt) return null;
  return candidate;
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
  let sdkMode = false;
  let readyThreadId: string | null = threadId;
  const liveAgentSteps = new Map<number, AgentStep>();
  const liveActivityItems: AgentActivityItem[] = [];
  const stepActivityOrders = new Map<number, number>();
  let nextActivityOrder = 0;

  const orderedSteps = () =>
    [...liveAgentSteps.values()].sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0));
  const publishSteps = () => options.onAgentSteps?.(orderedSteps());
  const publishActivity = () =>
    options.onActivity?.([...liveActivityItems].sort((a, b) => a.order - b.order));
  const ensureStepActivity = (stepIndex: number) => {
    if (!sdkMode || stepActivityOrders.has(stepIndex)) return;
    const order = nextActivityOrder++;
    stepActivityOrders.set(stepIndex, order);
    liveActivityItems.push({ id: `step-${stepIndex}`, type: 'step', order, stepIndex });
    publishActivity();
  };
  const normalizeTodos = (payload: any): AgentTodo[] => {
    const rows = Array.isArray(payload?.todos) ? payload.todos : Array.isArray(payload) ? payload : [];
    return rows
      .filter((row: any) => row && typeof row.content === 'string')
      .map((row: any, index: number) => ({
        id: String(row.id ?? `todo-${index}`),
        content: String(row.content),
        status: ['pending', 'in_progress', 'completed'].includes(row.status)
          ? row.status
          : 'pending',
        position: typeof row.position === 'number' ? row.position : index,
      }))
      .sort((a: AgentTodo, b: AgentTodo) => a.position - b.position);
  };
  const normalizeLiveSources = (payload: any): SourceRef[] => {
    const rows = Array.isArray(payload?.sources) ? payload.sources : [];
    const allowedKinds: SourceKind[] = ['wiki', 'platform', 'ip', 'context'];
    return rows
      .filter((row: any) => row && typeof row.label === 'string')
      .map((row: any) => ({
        kind: allowedKinds.includes(row.kind) ? row.kind : 'context',
        label: String(row.label).slice(0, 160),
        pageId: typeof row.pageId === 'string' ? row.pageId : undefined,
      }));
  };
  const mergeLiveSources = (incoming: SourceRef[]) => {
    const merged = new Map(sources.map((source) => [`${source.kind}:${source.label}`, source]));
    incoming.forEach((source) => merged.set(`${source.kind}:${source.label}`, source));
    sources = [...merged.values()];
    options.onSourcesUpdate?.(sources);
  };

  const streamHandlers = {
    onEvent: (event: string, payload: any) => {
      if (event === 'ready') {
        sdkMode = payload.sdkMode === true;
        // Defect 8: remembered so a turn whose stream dies mid-flight can still be recovered from the
        // database below. Without a thread id there is nothing to look the persisted turn up by.
        readyThreadId = typeof payload.threadId === 'string' ? payload.threadId : readyThreadId;
        userMessage = toMessage(payload.userMessage);
        route = payload.route;
        assembledContext = payload.assembledContext;
        for (const step of payload.agentSteps ?? []) {
          if (typeof step.stepIndex === 'number') {
            liveAgentSteps.set(step.stepIndex, step);
            ensureStepActivity(step.stepIndex);
          }
        }
        options.onUserMessage?.(userMessage);
        options.onReady?.({
          threadId: payload.threadId,
          route,
          assembledContext,
          agentSteps: payload.agentSteps ?? undefined,
          sdkMode,
        });
        publishActivity();
      }
      if (event === 'token') {
        const text = payload.text ?? '';
        const channel = payload.channel === 'narration' ? 'narration' : 'answer';
        const tokenSdkMode = payload.sdkMode === true || sdkMode;
        options.onToken?.(text, { channel, sdkMode: tokenSdkMode });
        if (tokenSdkMode && channel === 'narration' && text) {
          sdkMode = true;
          const segmentId = String(payload.segmentId ?? 'current');
          const itemId = `narration-${segmentId}`;
          const existing = liveActivityItems.find((item) => item.id === itemId);
          if (existing) existing.text = `${existing.text ?? ''}${text}`;
          else {
            liveActivityItems.push({
              id: itemId,
              type: 'narration',
              order: nextActivityOrder++,
              text,
            });
          }
          publishActivity();
        }
      }
      if (event === 'step' && typeof payload.stepIndex === 'number') {
        const current = liveAgentSteps.get(payload.stepIndex);
        liveAgentSteps.set(payload.stepIndex, {
          ...current,
          stepIndex: payload.stepIndex,
          stepType: payload.stepType ?? current?.stepType,
          title: payload.title ?? current?.title,
          summary: payload.summary ?? current?.summary,
          tool: current?.tool ?? payload.title ?? 'Agent step',
          input: current?.input ?? {},
          output: current?.output ?? '',
          status: payload.status ?? current?.status,
          parentToolUseId: payload.parentToolUseId ?? current?.parentToolUseId,
          sourceRefs: payload.sourceRefs ?? current?.sourceRefs ?? [],
          subAgent: payload.stepType === 'sub_agent'
            ? {
                ...current?.subAgent,
                capabilityKey: payload.capabilityKey ?? current?.subAgent?.capabilityKey,
                status: payload.status ?? current?.subAgent?.status ?? 'running',
              }
            : current?.subAgent,
          children: current?.children,
        });
        ensureStepActivity(payload.stepIndex);
        publishSteps();
      }
      if (event === 'tool_call' && typeof payload.stepIndex === 'number') {
        const current = liveAgentSteps.get(payload.stepIndex);
        liveAgentSteps.set(payload.stepIndex, {
          ...current,
          stepIndex: payload.stepIndex,
          stepType: payload.stepType,
          title: payload.title,
          summary: payload.summary,
          tool: payload.tool ?? payload.title ?? 'Agent tool',
          input: payload.input ?? {},
          output: '',
          status: payload.status ?? 'running',
          parentToolUseId: payload.parentToolUseId ?? current?.parentToolUseId,
          sourceRefs: payload.sourceRefs ?? [],
          subAgent: payload.stepType === 'sub_agent'
            ? {
                ...current?.subAgent,
                capabilityKey: payload.capabilityKey ?? payload.input?.capability_key,
                status: 'running',
              }
            : current?.subAgent,
          children: current?.children,
        });
        ensureStepActivity(payload.stepIndex);
        publishSteps();
      }
      if (event === 'sub_agent_step' && typeof payload.parentStepIndex === 'number') {
        const current = liveAgentSteps.get(payload.parentStepIndex);
        const applied = applySubAgentStepEvent(current, payload);
        if (applied.parent) {
          liveAgentSteps.set(payload.parentStepIndex, applied.parent);
          mergeLiveSources(applied.sources);
          publishSteps();
        }
      }
      if (event === 'tool_result' && typeof payload.stepIndex === 'number') {
        const current = liveAgentSteps.get(payload.stepIndex);
        const parsedOutput = (() => {
          try {
            return typeof payload.output === 'string' ? JSON.parse(payload.output) : payload.output;
          } catch {
            return null;
          }
        })();
        liveAgentSteps.set(payload.stepIndex, {
          stepIndex: payload.stepIndex,
          stepType: payload.stepType ?? current?.stepType,
          title: payload.title ?? current?.title,
          summary: payload.summary ?? current?.summary,
          tool: payload.tool ?? current?.tool ?? payload.title ?? 'Agent tool',
          input: current?.input ?? {},
          output: outputToString(payload.output ?? payload.summary ?? ''),
          status: payload.status ?? 'completed',
          parentToolUseId: payload.parentToolUseId ?? current?.parentToolUseId,
          sourceRefs: payload.sourceRefs ?? current?.sourceRefs ?? [],
          subAgent: (payload.stepType ?? current?.stepType) === 'sub_agent'
            ? {
                runId: childRunIdFromOutput(parsedOutput) ?? current.subAgent?.runId,
                capabilityKey: payload.capabilityKey ?? current.subAgent?.capabilityKey,
                status: parsedOutput?.status ?? payload.status,
                summary: parsedOutput?.result_summary,
              }
            : undefined,
          children: current?.children,
        });
        if ((payload.stepType ?? current?.stepType) === 'sub_agent') {
          mergeLiveSources(normalizeWorkerSourceRefs(payload.sourceRefs ?? []));
        }
        ensureStepActivity(payload.stepIndex);
        publishSteps();
      }
      if (event === 'heartbeat' && typeof payload.stepIndex === 'number') {
        const current = liveAgentSteps.get(payload.stepIndex);
        if (current) {
          liveAgentSteps.set(payload.stepIndex, {
            ...current,
            status: 'running',
            elapsedSeconds: typeof payload.elapsedSeconds === 'number' ? payload.elapsedSeconds : current.elapsedSeconds,
          });
          publishSteps();
        }
      }
      if (event === 'todos_updated') {
        options.onPlanUpdate?.(normalizeTodos(payload));
      }
      if (event === 'sources_updated') {
        mergeLiveSources(normalizeLiveSources(payload));
      }
      if (event === 'done') {
        sdkMode = payload.sdkMode === true || sdkMode;
        chat = payload.chat;
        const persistedSteps = Array.isArray(payload.assistantMessage?.agentSteps)
          ? payload.assistantMessage.agentSteps as AgentStep[]
          : [];
        const completedSteps = preserveNestedAgentSteps(orderedSteps(), persistedSteps);
        liveAgentSteps.clear();
        for (const step of completedSteps) {
          if (typeof step.stepIndex !== 'number') continue;
          liveAgentSteps.set(step.stepIndex, step);
          ensureStepActivity(step.stepIndex);
        }
        assistantMessage = toMessage(
          payload.assistantMessage,
          orderedSteps(),
          undefined,
          sdkMode ? 'sdk' : undefined,
          sdkMode ? [...liveActivityItems].sort((a, b) => a.order - b.order) : undefined,
        );
        artifactId = typeof payload.artifactId === 'string' ? payload.artifactId : null;
        const completedSources = normalizeWorkerSourceRefs(
          Array.isArray(payload.sources) ? payload.sources : [],
        );
        sources = completedSources.length > 0 ? completedSources : sources;
        sourcePages = payload.sourcePages ?? [];
        if (assistantMessage) rememberSources(assistantMessage.chatId, sources, sourcePages);
      }
      if (event === 'error') {
        throw new Error(payload.message ?? 'Virtual CSO stream failed.');
      }
    },
  };

  // DEFECT 8 — the SSE stream can fail two ways and only ONE was handled before. A CLEAN end without a
  // `done` event falls through to the recovery below. But a silent connection KILLED by the edge/proxy
  // surfaces as a THROWN network error out of reader.read() — the actual run-4 shape — which used to
  // escape past the recovery entirely and show the founder a bare "network error" (confirmed live by the
  // injected-disconnect canary, 2026-07-23: the answer had persisted with 33 citations, yet the founder
  // saw an error and had to reload). Catch it so BOTH shapes reach the same record-backed recovery; the
  // backend may have finished and persisted the answer regardless of how the client's stream died.
  let streamError: unknown = null;
  try {
    await parseSseStream(response, streamHandlers);
  } catch (error) {
    streamError = error;
  }

  if (!assistantMessage && readyThreadId) {
    // DEFECT 8 (04B-D2 SDK-M3, run 4). The SSE stream can die while the backend keeps working and
    // finishes normally — the assistant message is written, the run completes, the founder is billed.
    // The old code inferred "no `done` event" ⇒ "the turn was not saved" and threw. That inference is
    // simply wrong: on the run-4 canary the answer was persisted with 33 citations 140ms before the run
    // completed, and the founder was shown a failure for a turn that had succeeded. The stream is a
    // delivery channel, not the record — so ask the record before declaring anything lost.
    try {
      const persisted = await getMessagesForChat(readyThreadId);
      const recoveredAssistant = selectRecoverableAssistantMessage(persisted, userMessage);
      if (recoveredAssistant) {
        assistantMessage = recoveredAssistant;
        userMessage =
          userMessage ?? [...persisted].reverse().find((message) => message.role === 'user') ?? null;
        if (!chat) {
          const threadRow = await supabase
            .from('vcso_chat_threads')
            .select('*')
            .eq('id', readyThreadId)
            .maybeSingle();
          if (threadRow.data) chat = toChat(threadRow.data);
        }
      }
    } catch {
      // Recovery is best-effort. A failed lookup must fall through to the original error rather than
      // replacing a truthful "something went wrong" with a confusing one.
    }
  }

  if (!chat || !userMessage || !assistantMessage) {
    // Nothing was recoverable from the record. Keep the friendly, honest copy (it guides the founder to
    // reopen, which is what surfaced the answer on 2026-07-23) rather than a bare "network error", and
    // preserve the original stream failure as the cause for diagnostics.
    throw new Error(
      'Virtual CSO stream ended before the turn could be delivered. If the answer was saved it will '
        + 'appear when you reopen this conversation.',
      streamError ? { cause: streamError } : undefined,
    );
  }

  if (artifactId) {
    try {
      artifactDelivery = await getArtifact(artifactId);
      assistantMessage = { ...assistantMessage, artifactDeliveries: [artifactDelivery] };
    } catch {
      // A stale or unauthorized artifact should not hide the completed assistant answer.
    }
  }

  return { chat, userMessage, assistantMessage, sources, sourcePages, route, assembledContext, sdkMode };
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
