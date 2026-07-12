import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, CircleAlert, LoaderCircle } from 'lucide-react';
import type { AgentStep } from '../../../lib/virtualCsoMockData';

const parseOutput = (output: string): unknown => {
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
};

const displayValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
};

const inputPreview = (input: Record<string, unknown>) => {
  for (const key of ['query', 'pattern', 'question', 'canonical_key', 'document_id', 'folder_id', 'description']) {
    const value = input[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return Object.keys(input).length > 0 ? `${Object.keys(input).length} argument${Object.keys(input).length === 1 ? '' : 's'}` : 'No input arguments';
};

const resultPreview = (output: unknown, summary?: string) => {
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const record = output as Record<string, unknown>;
    for (const key of ['result_count', 'match_count', 'item_count', 'source_count', 'row_count', 'count']) {
      if (typeof record[key] === 'number') return `${record[key]} result${record[key] === 1 ? '' : 's'}`;
    }
    if (typeof record.summary === 'string') return record.summary;
    if (Object.keys(record).length === 0 && summary) return summary;
  }
  return summary || 'Results available';
};

const AgentStepRow: React.FC<{ step: AgentStep }> = ({ step }) => {
  const isRunning = step.status === 'running';
  const isFailed = step.status === 'failed';
  const [open, setOpen] = useState(isRunning);
  const output = parseOutput(step.output);
  const resultValue = output && typeof output === 'object' && !Array.isArray(output) && Object.keys(output).length === 0
    ? step.summary
    : output ?? step.summary;

  return (
    <div className="border-b border-[var(--aos-mist)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 py-2 text-left text-xs"
        aria-expanded={open}
      >
        <div className="mt-0.5 shrink-0" aria-label={isRunning ? 'Running' : isFailed ? 'Failed' : 'Completed'}>
          {isRunning ? (
            <LoaderCircle size={13} className="animate-spin text-[var(--aos-brass)]" />
          ) : isFailed ? (
            <CircleAlert size={13} className="text-[var(--aos-brass)]" />
          ) : (
            <span className="flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[var(--aos-sage)] text-[var(--fg-on-dark)]">
              <Check size={9} strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span className="aos-mono font-medium text-[var(--fg-2)]">{step.title ?? step.tool}</span>
            <span className="shrink-0 text-[var(--fg-4)]">
              {isRunning ? 'Running' : isFailed ? 'Needs attention' : resultPreview(output, step.summary)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[var(--fg-3)]">{inputPreview(step.input)}</div>
        </div>
        <ChevronDown size={13} className={`mt-0.5 shrink-0 text-[var(--fg-4)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mb-2 ml-5 grid gap-2">
          <div className="rounded-[var(--radius-xs)] bg-[var(--bg-canvas)] p-2">
            <div className="aos-mono mb-1 text-[10px] uppercase tracking-wide text-[var(--fg-4)]">Input</div>
            <pre className="aos-mono whitespace-pre-wrap break-words text-xs text-[var(--fg-2)]">{displayValue(step.input)}</pre>
          </div>
          <div className="rounded-[var(--radius-xs)] bg-[var(--bg-canvas)] p-2">
            <div className="aos-mono mb-1 text-[10px] uppercase tracking-wide text-[var(--fg-4)]">Results</div>
            <pre className="aos-mono max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--fg-2)]">
              {isRunning ? 'Running...' : displayValue(resultValue ?? 'No result summary returned.')}
            </pre>
          </div>
        </div>
      )}
      {step.subAgent && (
        <div className="mb-2 ml-5 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="aos-mono text-[10px] uppercase tracking-wide text-[var(--aos-brass)]">Sub-agent</div>
              <div className="mt-0.5 text-xs font-medium text-[var(--fg-2)]">
                {(step.subAgent.capabilityKey ?? step.title ?? 'Delegated analysis').replaceAll('_', ' ')}
              </div>
            </div>
            <span className="aos-mono text-[10px] uppercase text-[var(--fg-4)]">
              {step.subAgent.status ?? step.status ?? 'complete'}
            </span>
          </div>
          {step.subAgent.summary && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--fg-3)]">{step.subAgent.summary}</p>
          )}
          {step.children && step.children.length > 0 && (
            <div className="mt-2 border-l border-[var(--aos-brass)] pl-2">
              {step.children.map((child, index) => (
                <AgentStepRow key={child.stepIndex ?? index} step={child} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type StepGroupKey = 'context' | 'tools' | 'delegated' | 'completion';

const stepGroup = (step: AgentStep): StepGroupKey => {
  if (step.stepType === 'context_build') return 'context';
  if (step.stepType === 'result') return 'completion';
  if (step.stepType === 'sub_agent' || step.stepType === 'code_execution' || step.tool === 'delegate_to_sub_agent') {
    return 'delegated';
  }
  return 'tools';
};

const GROUP_LABELS: Record<StepGroupKey, string> = {
  context: 'Context prepared',
  tools: 'Tool activity',
  delegated: 'Delegated analysis',
  completion: 'Response prepared',
};

const GROUP_ORDER: StepGroupKey[] = ['context', 'tools', 'delegated', 'completion'];

export const AgentStepsPanel: React.FC<{ steps: AgentStep[] }> = ({ steps }) => {
  const [open, setOpen] = useState(() => steps.some((step) => step.status === 'running'));
  const runningCount = steps.filter((step) => step.status === 'running').length;
  const failedCount = steps.filter((step) => step.status === 'failed').length;
  const groupedSteps = GROUP_ORDER.map((key) => ({
    key,
    steps: steps.filter((step) => stepGroup(step) === key),
  })).filter((group) => group.steps.length > 0);
  const statusLabel = runningCount > 0
    ? `${runningCount} running`
    : failedCount > 0
      ? `${failedCount} need attention`
      : `${steps.length} complete`;

  return (
    <div className="mb-3 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--fg-3)] transition-colors hover:text-[var(--fg-2)]"
        aria-expanded={open}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="font-medium text-[var(--fg-2)]">{open ? 'Hide steps' : 'Show steps'}</span>
        <span className="aos-mono ml-auto text-[var(--fg-4)]">{statusLabel}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--aos-mist)] px-3 py-3">
          {groupedSteps.map((group) => (
            <section key={group.key} aria-label={GROUP_LABELS[group.key]}>
              <div className="aos-mono mb-1.5 text-[10px] uppercase tracking-wide text-[var(--fg-4)]">
                {GROUP_LABELS[group.key]}
              </div>
              <div className="border-l border-[var(--aos-mist)] pl-2">
                {group.steps.map((step, index) => (
                  <AgentStepRow key={step.stepIndex ?? index} step={step} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
