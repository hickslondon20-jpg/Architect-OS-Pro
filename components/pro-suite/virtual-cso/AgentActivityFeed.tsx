import React from 'react';
import { Check, ChevronRight, CircleAlert, LoaderCircle } from 'lucide-react';
import {
  buildNestedWorkerGroups,
  type AgentActivityItem,
  type AgentStep,
  type NestedWorkerGroup,
} from '../../../lib/virtualCsoApi';

interface AgentActivityFeedProps {
  items?: AgentActivityItem[];
  steps: AgentStep[];
}

const sourceLabels = (step: AgentStep): string[] =>
  (step.sourceRefs ?? [])
    .map((source) => {
      const label = source.label ?? source.title ?? source.source_title;
      return typeof label === 'string' ? label : null;
    })
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

const StepStatusIcon: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'running') {
    return <LoaderCircle size={14} className="animate-spin text-[var(--aos-brass)]" aria-label="Running" />;
  }
  if (status === 'failed') {
    return <CircleAlert size={14} className="text-[var(--aos-risk)]" aria-label="Needs attention" />;
  }
  return (
    <span
      className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--aos-success-tint)] text-[var(--aos-success)]"
      aria-label="Completed"
    >
      <Check size={10} strokeWidth={3} />
    </span>
  );
};

const NestedWorkerSteps: React.FC<{ group: NestedWorkerGroup }> = ({ group }) => (
  <ol
    className="mt-3 space-y-2 border-l border-[var(--aos-mist)] pl-3"
    aria-label={`${group.title} activity`}
    data-parent-tool-use-id={group.parentToolUseId}
  >
    {group.steps.map((child, index) => {
      const labels = sourceLabels(child);
      return (
        <li key={`${group.parentToolUseId}-${child.stepIndex ?? index}`}>
          <details className="group/child rounded-[var(--radius-xs)] bg-[var(--bg-sunken)]">
            <summary className="flex cursor-pointer list-none items-start gap-2.5 px-2.5 py-2 marker:content-none">
              <span className="mt-0.5 shrink-0"><StepStatusIcon status={child.status} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-[var(--fg-2)]">
                  {child.title ?? child.tool}
                </span>
                {child.summary && (
                  <span className="mt-0.5 block truncate text-xs text-[var(--fg-3)]">{child.summary}</span>
                )}
              </span>
              <ChevronRight
                size={12}
                className="mt-0.5 shrink-0 text-[var(--fg-4)] transition-transform group-open/child:rotate-90"
              />
            </summary>
            <div className="border-t border-[var(--aos-mist)] px-2.5 pb-2.5 pt-2">
              <p className="text-xs leading-5 text-[var(--fg-3)]">
                {child.summary ?? `${child.title ?? child.tool} ${child.status ?? 'completed'}.`}
              </p>
              {labels.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Worker sources">
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-[var(--aos-sage)] bg-[var(--aos-sage-soft)] px-2 py-0.5 text-[10px] text-[var(--fg-3)]"
                    >
                      {label}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </details>
        </li>
      );
    })}
  </ol>
);

const StepChip: React.FC<{ step: AgentStep; workerGroup?: NestedWorkerGroup }> = ({ step, workerGroup }) => {
  const labels = sourceLabels(step);
  const statusLabel = step.status === 'running'
    ? 'In progress'
    : step.status === 'failed'
      ? 'Needs attention'
      : 'Complete';

  return (
    <details
      className="group min-w-0 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)] open:border-[var(--aos-sage)]"
      data-parent-tool-use-id={workerGroup?.parentToolUseId}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-left marker:content-none">
        <StepStatusIcon status={step.status} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[var(--fg-2)]">
            {step.title ?? step.tool}
          </span>
          {step.summary && (
            <span className="mt-0.5 block truncate text-xs text-[var(--fg-3)]">{step.summary}</span>
          )}
        </span>
        <span className="aos-mono shrink-0 text-[10px] uppercase tracking-wide text-[var(--fg-4)]">
          {statusLabel}
        </span>
        <ChevronRight
          size={13}
          className="shrink-0 text-[var(--fg-4)] transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>

      <div className="border-t border-[var(--aos-mist)] px-3 pb-3 pt-2.5">
        <p className="text-xs leading-relaxed text-[var(--fg-3)]">
          {step.summary ?? `${step.title ?? step.tool} ${statusLabel.toLowerCase()}.`}
        </p>
        {labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources used">
            {labels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--aos-sage)] bg-[var(--aos-sage-soft)] px-2 py-0.5 text-[11px] text-[var(--fg-3)]"
              >
                {label}
              </span>
            ))}
          </div>
        )}
        {workerGroup && workerGroup.steps.length > 0 && <NestedWorkerSteps group={workerGroup} />}
      </div>
    </details>
  );
};

export const AgentActivityFeed: React.FC<AgentActivityFeedProps> = ({ items, steps }) => {
  const workerGroups = buildNestedWorkerGroups(steps);
  const workerGroupsByParentId = new Map(
    workerGroups.map((group) => [group.parentToolUseId, group]),
  );
  const stepsByIndex = new Map(
    steps
      .filter((step) => typeof step.stepIndex === 'number')
      .map((step) => [step.stepIndex as number, step]),
  );
  const activityItems = items && items.length > 0
    ? [...items].sort((a, b) => a.order - b.order)
    : steps
        .filter((step) => typeof step.stepIndex === 'number')
        .map((step, order) => ({
          id: `step-${step.stepIndex}`,
          type: 'step' as const,
          order,
          stepIndex: step.stepIndex,
        }));

  return (
    <div className="mb-5 w-full min-w-0 space-y-3" aria-label="Virtual CSO activity">
      {activityItems.map((item) => {
        if (item.type === 'narration') {
          return (
            <p key={item.id} className="max-w-[72ch] whitespace-pre-wrap text-sm leading-6 text-[var(--fg-2)]">
              {item.text}
            </p>
          );
        }
        const step = item.stepIndex === undefined ? undefined : stepsByIndex.get(item.stepIndex);
        return step
          ? (
              <StepChip
                key={item.id}
                step={step}
                workerGroup={step.parentToolUseId
                  ? workerGroupsByParentId.get(step.parentToolUseId)
                  : undefined}
              />
            )
          : null;
      })}
    </div>
  );
};
