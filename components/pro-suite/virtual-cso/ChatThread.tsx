import React from 'react';
import { ChevronRight } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../../lib/virtualCsoApi';

interface Crumb {
  label: string;
  onClick?: () => void;
}

/**
 * Center pane content above the composer: breadcrumb + scrollable message list.
 */
export const ChatThread: React.FC<{
  crumbs: Crumb[];
  messages: Message[];
  onOpenArtifact?: (artifactId: string) => void;
}> = ({ crumbs, messages, onOpenArtifact }) => (
  <div className="flex h-full flex-col overflow-hidden">
    <div className="flex items-center gap-1.5 border-b border-[var(--aos-mist)] px-6 py-3 text-xs text-[var(--fg-3)]">
      {crumbs.map((c, i) => (
        <React.Fragment key={`${c.label}-${i}`}>
          {i > 0 && <ChevronRight size={13} className="text-[var(--fg-4)]" />}
          {c.onClick ? (
            <button
              onClick={c.onClick}
              className="rounded transition-colors hover:text-[var(--fg-1)]"
            >
              {c.label}
            </button>
          ) : (
            <span className="font-medium text-[var(--fg-2)]">{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>

    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onOpenArtifact={onOpenArtifact} />
        ))}
      </div>
    </div>
  </div>
);
