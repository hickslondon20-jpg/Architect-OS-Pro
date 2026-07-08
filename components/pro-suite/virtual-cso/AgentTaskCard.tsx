import React, { useEffect, useState } from 'react';
import { ArrowUpRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AgentMark, StatusChip } from '../domain-agents/DomainAgentPrimitives';
import { getTask } from '../../../lib/tasksApi';
import type { AgentTaskHandle } from '../../../lib/virtualCsoApi';
import type { DomainTaskStatus } from '../../../pages/ProSuite/domain-agents/types';

export const AgentTaskCard: React.FC<{
  handle: AgentTaskHandle;
  onOpenArtifact?: (artifactId: string) => void;
}> = ({ handle, onOpenArtifact }) => {
  const [status, setStatus] = useState<DomainTaskStatus>(handle.task.status);
  const [artifactId, setArtifactId] = useState<string | null>(handle.artifactId ?? handle.task.artifactId ?? null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const state = await getTask(handle.task.id);
        if (cancelled) return;
        setStatus(state.task.status);
        setArtifactId(state.artifact?.id ?? null);
      } catch {
        // The card is a handle; stale status should not break the chat thread.
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [handle.task.id]);

  return (
    <div className="mb-4 w-full rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AgentMark agent={handle.agent} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-medium leading-snug text-[var(--fg-1)]">{handle.task.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-[var(--fg-3)]">
              {handle.agent.shortName} / {handle.workflow?.name ?? 'Free-form request'}
            </div>
          </div>
        </div>
        <StatusChip status={status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/pro/intelligence/domain-agents/tasks/${handle.task.id}`} className="aos-btn aos-btn--sm aos-btn--brass">
          <ArrowUpRight className="h-3.5 w-3.5" />
          Open in Workspace
        </Link>
        <button
          className="aos-btn aos-btn--sm aos-btn--outline"
          onClick={() => artifactId && onOpenArtifact?.(artifactId)}
          disabled={!artifactId}
        >
          <FileText className="h-3.5 w-3.5" />
          View artifact
        </button>
      </div>
    </div>
  );
};
