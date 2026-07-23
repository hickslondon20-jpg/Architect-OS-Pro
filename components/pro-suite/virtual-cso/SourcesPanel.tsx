import React from 'react';
import { BookOpen, Check, ChevronRight, FolderInput, Layers, Library, LoaderCircle } from 'lucide-react';
import {
  buildNestedWorkerGroups,
  SOURCE_KIND_LABELS,
  type AgentStep,
  type AgentTodo,
  type NestedWorkerGroup,
  type SourceKind,
  type SourceRef,
} from '../../../lib/virtualCsoApi';

interface TurnProgress {
  steps: AgentStep[];
  todos: AgentTodo[];
  streaming: boolean;
  workspaceFileCount?: number;
}

interface ProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
  workerGroup?: NestedWorkerGroup;
}

const progressItems = ({ steps, todos, streaming }: TurnProgress): ProgressItem[] => {
  const workerGroups = buildNestedWorkerGroups(steps);
  if (todos.length > 0) {
    return todos.map((todo) => {
      const workerGroup = workerGroups.find((group) => group.capabilityKey === todo.id);
      return {
        id: todo.id,
        label: todo.content,
        status: todo.status,
        workerGroup,
      };
    });
  }

  const uniqueSteps = new Map<number, AgentStep>();
  steps.forEach((step) => {
    if (typeof step.stepIndex === 'number' && step.stepType !== 'result') {
      uniqueSteps.set(step.stepIndex, step);
    }
  });
  const items = [...uniqueSteps.values()].slice(0, 7).map((step) => ({
    id: `step-${step.stepIndex}`,
    label: step.title ?? step.summary ?? 'Review evidence',
    workerGroup: step.parentToolUseId
      ? workerGroups.find((group) => group.parentToolUseId === step.parentToolUseId)
      : undefined,
    status: step.status === 'running'
      ? 'in_progress' as const
      : step.status === 'failed'
        ? 'pending' as const
        : 'completed' as const,
  }));
  const hasRunningStep = items.some((item) => item.status === 'in_progress');
  items.push({
    id: 'prepare-response',
    label: 'Prepare the strategic response',
    status: streaming ? (hasRunningStep ? 'pending' : 'in_progress') : 'completed',
  });
  return items;
};

const ProgressPanel: React.FC<{ progress: TurnProgress }> = ({ progress }) => {
  const items = progressItems(progress);
  const completeCount = items.filter((item) => item.status === 'completed').length;

  return (
    <section className="border-b border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-4" aria-label="Turn progress">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--fg-1)]">Progress</h2>
        <span className="aos-mono text-[10px] uppercase tracking-wide text-[var(--fg-4)]">
          {completeCount}/{items.length}
        </span>
      </div>
      {(progress.workspaceFileCount ?? 0) > 0 && (
        <p className="mt-1 text-[10px] text-[var(--fg-4)]">
          {progress.workspaceFileCount} persisted workspace file{progress.workspaceFileCount === 1 ? '' : 's'}
        </p>
      )}
      <ol className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <li key={item.id}>
            <div className="flex gap-2.5">
              <span
                className={`aos-mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  item.status === 'completed'
                    ? 'border-[var(--aos-success)] bg-[var(--aos-success-tint)] text-[var(--aos-success)]'
                    : item.status === 'in_progress'
                      ? 'border-[var(--aos-brass)] bg-[var(--bg-surface)] text-[var(--aos-brass)]'
                      : 'border-[var(--aos-mist)] bg-[var(--bg-sunken)] text-[var(--fg-4)]'
                }`}
                aria-label={item.status.replace('_', ' ')}
              >
                {item.status === 'completed'
                  ? <Check size={11} strokeWidth={3} />
                  : item.status === 'in_progress'
                    ? <LoaderCircle size={11} className="animate-spin" />
                    : index + 1}
              </span>
              <span className={`text-xs leading-5 ${
                item.status === 'completed'
                  ? 'text-[var(--fg-4)] line-through decoration-[var(--aos-mist)]'
                  : item.status === 'in_progress'
                    ? 'font-medium text-[var(--fg-1)]'
                    : 'text-[var(--fg-3)]'
              }`}>
                {item.label}
              </span>
            </div>
            {item.workerGroup && item.workerGroup.steps.length > 0 && (
              <details
                className="group ml-2.5 mt-1.5 border-l border-[var(--aos-mist)] pl-4"
                data-parent-tool-use-id={item.workerGroup.parentToolUseId}
              >
                <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--fg-4)] marker:content-none">
                  <ChevronRight size={11} className="transition-transform group-open:rotate-90" />
                  {item.workerGroup.title} · {item.workerGroup.status}
                </summary>
                <ol className="mt-1 space-y-2 pb-1">
                  {item.workerGroup.steps.map((child, childIndex) => (
                    <li key={`${item.workerGroup!.parentToolUseId}-${child.stepIndex ?? childIndex}`}>
                      <details className="group/child rounded-[var(--radius-xs)] bg-[var(--bg-sunken)]">
                        <summary className="flex cursor-pointer list-none items-start gap-2 px-2 py-1.5 marker:content-none">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                            child.status === 'failed'
                              ? 'bg-[var(--aos-risk)]'
                              : child.status === 'running'
                                ? 'bg-[var(--aos-brass)]'
                                : 'bg-[var(--aos-success)]'
                          }`} />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4 text-[var(--fg-2)]">
                            {child.title ?? child.tool}
                          </span>
                          <ChevronRight
                            size={10}
                            className="mt-0.5 shrink-0 text-[var(--fg-4)] transition-transform group-open/child:rotate-90"
                          />
                        </summary>
                        {child.summary && (
                          <p className="border-t border-[var(--aos-mist)] px-2 py-1.5 text-[10px] leading-4 text-[var(--fg-4)]">
                            {child.summary}
                          </p>
                        )}
                      </details>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

const KIND_ORDER: SourceKind[] = ['wiki', 'platform', 'ip', 'context'];

const KIND_ICONS: Record<SourceKind, React.ElementType> = {
  wiki: BookOpen,
  platform: Layers,
  ip: Library,
  context: FolderInput,
};

/**
 * Right panel — the provenance layer. Sections per source kind.
 * Clickable items (wiki / ip with a pageId) open the shared Reader.
 * Default (no active chat) shows a short hint.
 */
export const SourcesPanel: React.FC<{
  sources: SourceRef[];
  hasActiveChat: boolean;
  onOpenSource: (pageId: string) => void;
  progress?: TurnProgress;
}> = ({ sources, hasActiveChat, onOpenSource, progress }) => (
  <aside
    className={`flex flex-shrink-0 flex-col border-l border-[var(--aos-mist)] bg-[var(--bg-canvas)] ${progress ? 'w-[300px]' : 'w-[260px]'}`}
    aria-label={progress ? 'Progress and sources' : 'Sources'}
  >
    {progress && <ProgressPanel progress={progress} />}
    <div className="border-b border-[var(--aos-mist)] px-4 py-3.5">
      <p className="aos-eyebrow">Sources</p>
      <p className="mt-1 text-xs text-[var(--fg-3)]">What this conversation is drawing on.</p>
    </div>

    <div className="flex-1 overflow-y-auto px-4 py-4">
      {!hasActiveChat || sources.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--fg-3)]">
          Sources populate here as the conversation pulls from your wiki, platform data, and the
          Architect OS IP.
        </p>
      ) : (
        <div className="space-y-5">
          {KIND_ORDER.map((kind) => {
            const items = sources.filter((s) => s.kind === kind);
            if (items.length === 0) return null;
            const Icon = KIND_ICONS[kind];
            return (
              <div key={kind}>
                <p className="aos-eyebrow flex items-center gap-1.5 pb-2">
                  <Icon size={11} /> {SOURCE_KIND_LABELS[kind]}
                </p>
                <div className="space-y-1.5">
                  {items.map((s, i) => {
                    const clickable = Boolean(s.pageId);
                    if (clickable) {
                      return (
                        <button
                          key={`${kind}-${i}`}
                          onClick={() => onOpenSource(s.pageId!)}
                          className="group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2.5 py-2 text-left text-sm text-[var(--fg-2)] transition-colors hover:border-[var(--aos-brass)] hover:text-[var(--fg-1)]"
                        >
                          <span className="truncate">{s.label}</span>
                          <ChevronRight
                            size={13}
                            className="flex-shrink-0 text-[var(--fg-4)] transition-colors group-hover:text-[var(--aos-brass)]"
                          />
                        </button>
                      );
                    }
                    return (
                      <span
                        key={`${kind}-${i}`}
                        className="inline-flex max-w-full items-center rounded-full bg-[var(--bg-sunken)] px-2.5 py-1 text-xs text-[var(--fg-2)]"
                      >
                        <span className="truncate">{s.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </aside>
);
