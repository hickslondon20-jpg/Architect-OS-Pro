import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AgentStep } from '../../../lib/virtualCsoMockData';

export const AgentStepsPanel: React.FC<{ steps: AgentStep[] }> = ({ steps }) => {
  const [open, setOpen] = useState(false);

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
          KB Explorer used {steps.length} {steps.length === 1 ? 'tool' : 'tools'}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-[var(--aos-mist)] px-3 py-2">
          {steps.map((step, i) => (
            <div key={i} className="text-xs">
              <div className="aos-mono font-medium text-[var(--fg-3)]">{step.tool}</div>
              {Object.keys(step.input).length > 0 && (
                <div className="mt-0.5 truncate text-[var(--fg-4)]">
                  {JSON.stringify(step.input).slice(0, 80)}
                </div>
              )}
              <div className="mt-0.5 line-clamp-2 text-[var(--fg-3)]">
                {step.output.slice(0, 120)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
