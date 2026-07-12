import React, { useState } from 'react';
import { Check, ChevronRight, LoaderCircle } from 'lucide-react';
import type { AgentStep } from '../../../lib/virtualCsoMockData';

export const AgentStepsPanel: React.FC<{ steps: AgentStep[] }> = ({ steps }) => {
  const [open, setOpen] = useState(() => steps.some((step) => step.status === 'running'));
  const runningCount = steps.filter((step) => step.status === 'running').length;

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
          {runningCount > 0
            ? `Working - ${runningCount} ${runningCount === 1 ? 'step' : 'steps'} running`
            : `${steps.length} ${steps.length === 1 ? 'step' : 'steps'} completed`}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-[var(--aos-mist)] px-3 py-2">
          {steps.map((step, i) => {
            const isRunning = step.status === 'running';
            return (
              <div key={step.stepIndex ?? i} className="flex gap-2 text-xs">
                <div className="mt-0.5 shrink-0" aria-label={isRunning ? 'Running' : 'Completed'}>
                  {isRunning ? (
                    <LoaderCircle size={13} className="animate-spin text-[var(--aos-brass)]" />
                  ) : (
                    <span className="flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[var(--aos-sage)] text-[var(--fg-on-dark)]">
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="aos-mono font-medium text-[var(--fg-3)]">{step.title ?? step.tool}</div>
                  {Object.keys(step.input).length > 0 && (
                    <div className="mt-0.5 truncate text-[var(--fg-4)]">
                      {JSON.stringify(step.input).slice(0, 80)}
                    </div>
                  )}
                  <div className="mt-0.5 line-clamp-2 text-[var(--fg-3)]">
                    {isRunning ? 'Running...' : step.output.slice(0, 120)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
