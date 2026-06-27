import React from 'react';
import { FileCheck2, RefreshCw, Lightbulb, Loader, Activity } from 'lucide-react';
import { Badge } from '../../../ui';
import type { LogEntry } from '../../../../lib/osEngineApi';

const ICONS: Record<string, React.ElementType> = {
  FileCheck2,
  RefreshCw,
  Lightbulb,
  Loader,
  Activity,
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const LogView: React.FC<{ entries: LogEntry[] }> = ({ entries: incomingEntries }) => {
  const entries: LogEntry[] = [...incomingEntries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="px-8 py-8">
      <h1 className="aos-h1 mb-1">Log</h1>
      <p className="mb-6 text-[var(--fg-2)]">
        A chronological feed of system activity and decision signals over time.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
          No activity yet. Ingestion and synthesis events will appear here once WS4 is online.
        </div>
      ) : (
        <ol className="relative ml-2 border-l border-[var(--aos-mist)]">
          {entries.map((entry) => {
          const Icon = ICONS[entry.icon] ?? Activity;
          const isDecision = entry.kind === 'decision';
          return (
            <li key={entry.id} className="mb-6 ml-6">
              <span
                className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border ${
                  isDecision
                    ? 'border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] text-[var(--aos-brass)]'
                    : 'border-[var(--aos-mist)] bg-[var(--bg-surface)] text-[var(--fg-3)]'
                }`}
              >
                <Icon size={13} />
              </span>
              <div className="flex items-center gap-2">
                <Badge color={isDecision ? 'yellow' : 'gray'}>
                  {isDecision ? 'Decision' : 'Activity'}
                </Badge>
                <span className="aos-mono text-xs text-[var(--fg-3)]">{formatTime(entry.timestamp)}</span>
              </div>
              <p className="mt-1.5 text-sm text-[var(--fg-1)]">{entry.text}</p>
            </li>
          );
          })}
        </ol>
      )}
    </div>
  );
};
