import React from 'react';
import { BookOpen, Check, ChevronRight, FolderInput, Layers, Library, LoaderCircle } from 'lucide-react';
import {
  SOURCE_KIND_LABELS,
  type AgentStep,
  type AgentTodo,
  type SourceKind,
  type SourceRef,
} from '../../../lib/virtualCsoApi';

interface TurnProgress {
  steps: AgentStep[];
  todos: AgentTodo[];
  streaming: boolean;
}

interface ProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const progressItems = ({ steps, todos, streaming }: TurnProgress): ProgressItem[] => {
  if (todos.length > 0) {
    return todos.map((todo) => ({ id: todo.id, label: todo.content, status: todo.status }));
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
      <ol className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-2.5">
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
