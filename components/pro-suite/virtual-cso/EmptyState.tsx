import React from 'react';
import { Compass, ArrowRight } from 'lucide-react';
import { INSIGHT_STARTERS } from '../../../lib/virtualCsoApi';

/**
 * New-chat / empty state. Open invitation + insight-moment starters.
 * Clicking a starter opens a (mock) conversation via onStart.
 */
export const EmptyState: React.FC<{ onStart?: (starterId: string) => void }> = ({ onStart }) => (
  <div className="flex h-full flex-col items-center justify-center px-6 py-12">
    <div className="w-full max-w-2xl">
      <div
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)]"
        style={{ backgroundColor: 'var(--bg-inverse)' }}
      >
        <Compass size={24} style={{ color: 'var(--aos-brass)' }} />
      </div>
      <h2 className="aos-h2 mb-2">What are you working through?</h2>
      <p className="mb-8 text-[var(--fg-2)]">
        Your Virtual CSO reads your agency's context — your wiki, your assessments, the current sprint —
        and thinks it through with you. Start anywhere, or pick up one of these.
      </p>

      <div className="space-y-2.5">
        {INSIGHT_STARTERS.map((starter) => (
          <button
            key={starter.id}
            onClick={() => onStart?.(starter.id)}
            className="group flex w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3.5 text-left transition-colors hover:border-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--fg-1)]">{starter.label}</p>
              <p className="mt-0.5 text-xs text-[var(--fg-3)]">{starter.hint}</p>
            </div>
            <ArrowRight
              size={16}
              className="flex-shrink-0 text-[var(--fg-4)] transition-colors group-hover:text-[var(--aos-brass)]"
            />
          </button>
        ))}
      </div>
    </div>
  </div>
);
