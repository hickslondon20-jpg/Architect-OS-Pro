import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Download, Plus } from 'lucide-react';
import {
  AgentMark,
  SectionEyebrow,
  StatusChip,
} from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { AgentStepsPanel } from '../../../components/pro-suite/virtual-cso/AgentStepsPanel';
import { ChatThread } from '../../../components/pro-suite/virtual-cso/ChatThread';
import { Composer } from '../../../components/pro-suite/virtual-cso/Composer';
import { listDomainAgents } from '../../../lib/domainAgentsApi';
import {
  getTask,
  getTaskFile,
  promoteTaskArtifact,
  replyTask,
  runTask,
  uploadTaskFile,
  type TaskState,
  type TaskStreamEvent,
} from '../../../lib/tasksApi';
import type { AgentStep, Message } from '../../../lib/virtualCsoApi';
import type { DomainAgent, DomainProgressStep, DomainTaskStatus, DomainWorkflow } from './types';

export const DomainAgentWorkspace: React.FC = () => {
  const { taskId } = useParams();
  const [agents, setAgents] = useState<DomainAgent[]>([]);
  const [taskState, setTaskState] = useState<TaskState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [trace, setTrace] = useState<AgentStep[]>([]);
  const [artifactHtml, setArtifactHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const agent = useMemo(() => {
    if (!taskState) return undefined;
    return agents.find((item) => item.uuid === taskState.task.agent_id);
  }, [agents, taskState]);
  const workflow: DomainWorkflow | undefined = useMemo(() => {
    if (!taskState) return undefined;
    return agents.flatMap((item) => item.workflows).find((item) => item.id === taskState.task.workflow_id);
  }, [agents, taskState]);

  const status = taskState?.task.status ?? 'ready';
  const progress = useMemo(() => buildProgress(taskState), [taskState]);
  const canReviewArtifact = status === 'review' || status === 'done';
  const registeredArtifact = taskState?.artifact ?? null;
  const promotedToKb = Boolean(registeredArtifact?.promoted_to_kb);

  const refreshTask = async (id: string) => {
    const state = await getTask(id);
    setTaskState(state);
    setMessages(messagesFromState(state));
    setTrace(traceFromState(state));
    await loadArtifactPreview(state);
    return state;
  };

  useEffect(() => {
    if (!taskId) return;
    let mounted = true;
    Promise.all([listDomainAgents(), getTask(taskId)])
      .then(async ([agentRows, state]) => {
        if (!mounted) return;
        setAgents(agentRows);
        setTaskState(state);
        setMessages(messagesFromState(state));
        setTrace(traceFromState(state));
        await loadArtifactPreview(state);
        if (state.task.status === 'ready' || state.task.status === 'running') {
          void startRun(taskId);
        }
      })
      .catch((err) => mounted && setError(err instanceof Error ? err.message : 'Could not load task.'));
    return () => {
      mounted = false;
    };
  }, [taskId]);

  const loadArtifactPreview = async (state: TaskState) => {
    const artifact = state.workspace.find((file) => file.file_path === 'artifact.html');
    if (!artifact) {
      setArtifactHtml('');
      return;
    }
    try {
      const file = await getTaskFile(state.task.id, artifact.file_path);
      setArtifactHtml(file.content || '');
    } catch {
      setArtifactHtml('');
    }
  };

  const startRun = async (id = taskId) => {
    if (!id || streaming) return;
    setStreaming(true);
    setError(null);
    try {
      await runTask(id, async (event) => {
        applyTaskEvent(event);
      });
      await refreshTask(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task stream failed.');
    } finally {
      setStreaming(false);
    }
  };

  const applyTaskEvent = (event: TaskStreamEvent) => {
    const content = narrationForEvent(event);
    if (content) {
      setMessages((current) => [
        ...current,
        {
          id: `${event.event}-${Date.now()}-${current.length}`,
          chatId: String(event.payload.task_id ?? taskId ?? 'task'),
          role: 'assistant',
          content,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    const step = traceForEvent(event);
    if (step) {
      setTrace((current) => [...current, step]);
    }
    const nextStatus = statusFromEvent(event);
    if (nextStatus) {
      setTaskState((current) => current ? { ...current, task: { ...current.task, status: nextStatus } } : current);
    }
  };

  const submitReply = async (text: string) => {
    if (!taskId) return;
    setMessages((current) => [
      ...current,
      { id: `founder-${Date.now()}`, chatId: taskId, role: 'user', content: text, createdAt: new Date().toISOString() },
    ]);
    try {
      const state = await replyTask(taskId, text);
      setTaskState(state);
      await startRun(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reply.');
    }
  };

  const attachFile = async (file: File) => {
    if (!taskId) return;
    const content = await file.text();
    setMessages((current) => [
      ...current,
      { id: `upload-${Date.now()}`, chatId: taskId, role: 'user', content: `Attached ${file.name}.`, createdAt: new Date().toISOString() },
    ]);
    try {
      const state = await uploadTaskFile(taskId, file.name, content);
      setTaskState(state);
      await startRun(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach file.');
    }
  };

  const promoteArtifact = async () => {
    if (!taskId || !registeredArtifact?.id || promoting) return;
    setPromoting(true);
    setError(null);
    try {
      await promoteTaskArtifact(taskId, registeredArtifact.id);
      await refreshTask(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add artifact to Second Brain.');
    } finally {
      setPromoting(false);
    }
  };

  if (!taskId) {
    return <div className="text-sm text-[var(--fg-3)]">Task not found.</div>;
  }

  const fallbackAgent: DomainAgent = {
    id: 'financial',
    name: 'Domain Agent',
    shortName: 'Agent',
    initial: 'A',
    color: 'var(--aos-obsidian)',
    discipline: '',
    strength: '',
    activity: '',
    fullDescription: '',
    capabilities: [],
    thoughtStarters: [],
    workflows: [],
  };
  const activeAgent = agent ?? fallbackAgent;
  const workflowName = workflow?.name ?? taskState?.workflow?.name ?? 'Workflow';
  const taskTitle = taskState?.task.title ?? 'Domain Agent Task';

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void attachFile(file);
          event.currentTarget.value = '';
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/pro/intelligence/domain-agents/agents/${activeAgent.id}`} className="aos-btn aos-btn--outline aos-btn--sm">
            <ArrowLeft className="h-4 w-4" />
            {activeAgent.shortName} Agent
          </Link>
          <StatusChip status={status} waitingOn={blockedQuestion(taskState)} />
        </div>
        <Link to="/pro/intelligence/domain-agents/tasks" className="aos-btn aos-btn--ghost aos-btn--sm">
          View Kanban
        </Link>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--aos-risk)] bg-[var(--aos-risk-tint)] px-4 py-3 text-sm text-[var(--aos-risk)]">
          {error}
        </div>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <AgentMark agent={activeAgent} />
            <div>
              <div className="text-sm font-semibold text-[var(--fg-1)]">{taskTitle}</div>
              <div className="aos-mono text-xs text-[var(--fg-3)]">
                {workflowName} / {taskId.slice(0, 8)} / {streaming ? 'streaming' : status}
              </div>
            </div>
          </div>
          <div className="text-xs text-[var(--fg-3)]">
            Resources: <span className="aos-mono text-[var(--fg-1)]">{taskState?.workspace.length ?? 0} attached</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-h-[620px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
          <div className="border-b border-[var(--aos-mist)] px-5 py-4">
            <SectionEyebrow>Task-bound workspace</SectionEyebrow>
            <p className="text-sm leading-relaxed text-[var(--fg-3)]">
              The agent runs the fixed workflow, asks for missing resources, and stays bound to this task.
            </p>
          </div>

          <div className="h-[520px]">
            <ChatThread
              crumbs={[
                { label: activeAgent.shortName },
                { label: workflowName },
                { label: status },
              ]}
              messages={messages}
            />
          </div>

          <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] px-5 py-4">
            <SectionEyebrow>Progress</SectionEyebrow>
            <div className="mb-4 space-y-3">
              {progress.map((step) => (
                <div key={step.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`h-3.5 w-3.5 rounded-full border-2 ${
                      step.state === 'done'
                        ? 'border-[var(--aos-brass)] bg-[var(--aos-brass)]'
                        : step.state === 'current'
                          ? 'border-[var(--aos-brass)] bg-[var(--bg-surface)]'
                          : 'border-[var(--aos-steel-blue)] bg-transparent'
                    }`}
                  />
                  <span className={step.state === 'pending' ? 'text-[var(--fg-3)]' : 'text-[var(--fg-1)]'}>{step.label}</span>
                </div>
              ))}
            </div>
            {trace.length > 0 && <AgentStepsPanel steps={trace} />}
            <Composer
              placeholder="Reply to unblock, ask about this artifact, or attach a needed resource..."
              onSubmit={submitReply}
              onAttach={() => fileInputRef.current?.click()}
            />
            <p className="mt-2 text-center text-[11px] text-[var(--fg-4)]">
              Scoped to this task. Open-ended strategy belongs in Virtual CSO.
            </p>
          </div>
        </div>

        <aside className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--aos-mist)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--fg-1)]">Artifact preview</div>
              <div className="aos-mono text-xs text-[var(--fg-3)]">artifact.html</div>
            </div>
            <span className="aos-chip aos-chip--brass">Right rail</span>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-5">
            {artifactHtml ? (
              <div className="os-reader-markdown" dangerouslySetInnerHTML={{ __html: artifactHtml }} />
            ) : (
              <div className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-8 text-center text-sm text-[var(--fg-3)]">
                The artifact preview appears here once the workflow writes artifact.html.
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--aos-mist)] p-4">
            {canReviewArtifact ? (
              <>
                <button className="aos-btn aos-btn--primary w-full" disabled>
                  <Check className="h-4 w-4" />
                  Accept review
                </button>
                <button
                  className="aos-btn aos-btn--outline w-full"
                  onClick={() => downloadHtml(artifactHtml || '', `${taskTitle}.html`)}
                  disabled={!artifactHtml}
                >
                  <Download className="h-4 w-4" />
                  Download artifact
                </button>
                <button
                  className={`aos-btn ${promotedToKb ? 'aos-btn--ghost' : 'aos-btn--brass'} w-full`}
                  onClick={promoteArtifact}
                  disabled={!registeredArtifact?.id || promotedToKb || promoting}
                >
                  {promotedToKb ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {promotedToKb ? 'In Second Brain' : promoting ? 'Adding...' : 'Add to Second Brain'}
                </button>
              </>
            ) : (
              <p className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-3 text-sm leading-relaxed text-[var(--fg-3)]">
                Download and Second Brain promotion unlock when the task reaches Review.
              </p>
            )}
            <Link
              to="/settings/ai-usage"
              className="block text-center text-xs font-medium text-[var(--aos-slate-blue)] hover:text-[var(--aos-obsidian)]"
            >
              View AI usage in Settings
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
};

const messagesFromState = (state: TaskState): Message[] => {
  const messages: Message[] = [
    {
      id: `${state.task.id}-intro`,
      chatId: state.task.id,
      role: 'assistant',
      content: `I am running ${state.workflow?.name ?? state.task.title} as a fixed Domain Agent workflow.`,
      createdAt: state.task.created_at,
    },
  ];
  const results = state.task.step_results ?? {};
  Object.keys(results)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .forEach((key) => {
      const result = results[key] as { summary?: string };
      if (result?.summary) {
        messages.push({
          id: `${state.task.id}-step-${key}`,
          chatId: state.task.id,
          role: 'assistant',
          content: result.summary,
          createdAt: state.task.updated_at,
        });
      }
    });
  const blocked = results._blocked as { question?: string } | undefined;
  if (blocked?.question) {
    messages.push({
      id: `${state.task.id}-blocked`,
      chatId: state.task.id,
      role: 'assistant',
      content: blocked.question,
      createdAt: state.task.updated_at,
    });
  }
  return messages;
};

const traceFromState = (state: TaskState): AgentStep[] => {
  const results = state.task.step_results ?? {};
  return Object.keys(results)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const result = results[key] as { name?: string; step_type?: string; summary?: string; source_refs?: Record<string, unknown>[] };
      return {
        stepIndex: Number(key),
        stepType: result.step_type,
        title: result.name,
        summary: result.summary,
        sourceRefs: result.source_refs ?? [],
        tool: result.name ?? 'workflow_step',
        input: {},
        output: result.summary ?? '',
        status: 'completed',
      };
    });
};

const buildProgress = (state: TaskState | null): DomainProgressStep[] => {
  if (!state) return [{ label: 'Loading task', state: 'current' }];
  const status = state.task.status;
  return state.steps.map((step, index) => {
    let stepState: DomainProgressStep['state'] = 'pending';
    if (status === 'review' || status === 'done' || index < state.task.current_step) stepState = 'done';
    if (index === state.task.current_step && status !== 'review' && status !== 'done') stepState = 'current';
    return {
      label: status === 'blocked' && index === state.task.current_step ? 'Waiting on founder input' : step.name,
      state: stepState,
    };
  });
};

const narrationForEvent = (event: TaskStreamEvent): string => {
  if (event.event === 'task_ready') return 'Task started. I am checking the workflow prerequisites.';
  if (event.event === 'task_step_start') return `Starting ${String(event.payload.name ?? 'the next step')}.`;
  if (event.event === 'task_step_complete') return String(event.payload.summary ?? 'Step completed.');
  if (event.event === 'task_blocked') return String(event.payload.question ?? 'I need input before I can continue.');
  if (event.event === 'task_review') return 'The draft artifact is ready for founder review.';
  if (event.event === 'task_done') return 'This task is complete.';
  if (event.event === 'task_error') return String(event.payload.error ?? 'The task hit an error.');
  return '';
};

const traceForEvent = (event: TaskStreamEvent): AgentStep | null => {
  if (!event.event.includes('step') && !event.event.includes('sub_agent') && event.event !== 'task_batch_progress') return null;
  return {
    stepIndex: Number(event.payload.index ?? event.payload.step_index ?? Date.now()),
    stepType: event.event,
    title: String(event.payload.name ?? event.payload.title ?? event.event),
    summary: String(event.payload.summary ?? event.payload.status ?? ''),
    sourceRefs: [],
    tool: String(event.payload.name ?? event.event),
    input: {},
    output: String(event.payload.summary ?? ''),
    status: event.event.endsWith('complete') ? 'completed' : 'running',
  };
};

const statusFromEvent = (event: TaskStreamEvent): DomainTaskStatus | null => {
  if (event.event === 'task_ready') return 'running';
  if (event.event === 'task_step_start') return 'running';
  if (event.event === 'task_blocked') return 'blocked';
  if (event.event === 'task_review') return 'review';
  if (event.event === 'task_done') return 'done';
  return null;
};

const blockedQuestion = (state: TaskState | null): string | undefined => {
  const blocked = state?.task.step_results?._blocked as { question?: string } | undefined;
  return blocked?.question;
};

const downloadHtml = (html: string, filename: string) => {
  if (!html) return;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[\\/:*?"<>|]/g, '-');
  anchor.click();
  URL.revokeObjectURL(url);
};
