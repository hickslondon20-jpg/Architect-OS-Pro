import React, { useState } from 'react';
import { Bot, ChevronRight, Code2, Wrench } from 'lucide-react';
import type { AgentStep } from '../../../lib/virtualCsoMockData';
import { citationLabel } from './CitationReaderBody';

export const AgentStepsPanel: React.FC<{ steps: AgentStep[] }> = ({ steps }) => {
  const [open, setOpen] = useState(false);
  const orderedSteps = [...steps].sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0));

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
        <span className="aos-mono">
          CSO trace used {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-[var(--aos-mist)] px-3 py-2">
          {orderedSteps.map((step, i) => (
            <TraceStep key={`${step.stepIndex ?? i}-${step.tool}`} step={step} />
          ))}
        </div>
      )}
    </div>
  );
};

const TraceStep: React.FC<{ step: AgentStep }> = ({ step }) => {
  const type = normalizeStepType(step.stepType, step.tool);
  const Icon = type === 'code_execution' ? Code2 : type === 'sub_agent' ? Bot : Wrench;
  const label = type === 'code_execution' ? 'Code execution' : type === 'sub_agent' ? 'Sub-agent' : 'Tool step';
  const title = step.title || step.tool || label;
  const summary = step.summary || step.output;
  const inputText = formatInput(step.input);

  return (
    <div className={`rounded-[var(--radius-xs)] border px-3 py-2 text-xs ${typeClassName(type)}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--aos-cloud)] text-[var(--aos-obsidian)]">
          <Icon size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="aos-mono text-[10px] uppercase text-[var(--fg-4)]">
              {label}
            </span>
            {step.status && (
              <span className="aos-mono text-[10px] text-[var(--fg-4)]">{step.status}</span>
            )}
          </div>
          <div className="mt-1 font-medium text-[var(--fg-2)]">{title}</div>
          {summary && <div className="mt-1 line-clamp-2 text-[var(--fg-3)]">{summary}</div>}
          {inputText && <div className="mt-1 truncate text-[var(--fg-4)]">{inputText}</div>}
          {step.sourceRefs && step.sourceRefs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {step.sourceRefs
                .filter((ref) => ref.source_kind === 'derived')
                .map((ref, index) => (
                  <span
                    key={`${ref.source_id ?? ref.source_label ?? 'derived'}-${index}`}
                    className="inline-flex max-w-full rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 text-[10px] text-[var(--fg-3)]"
                    title={citationLabel(ref)}
                  >
                    <span className="truncate">{citationLabel(ref)}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const normalizeStepType = (stepType: string | undefined, tool: string): string => {
  if (stepType === 'code_execution' || stepType === 'sub_agent') return stepType;
  if (tool === 'execute_code') return 'code_execution';
  if (tool === 'delegate_to_sub_agent') return 'sub_agent';
  return 'tool_call';
};

const typeClassName = (type: string): string => {
  if (type === 'code_execution') {
    return 'border-[var(--aos-brass)] bg-[var(--aos-parchment)]';
  }
  if (type === 'sub_agent') {
    return 'border-[var(--aos-slate-blue)] bg-[var(--aos-cloud)]';
  }
  return 'border-[var(--aos-mist)] bg-[var(--aos-cloud)]';
};

const formatInput = (input: Record<string, unknown>): string => {
  if (!input || Object.keys(input).length === 0) return '';
  return JSON.stringify(input).slice(0, 100);
};
