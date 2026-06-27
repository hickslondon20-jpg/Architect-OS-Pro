import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Download, Paperclip, Plus, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  AgentMark,
  SectionEyebrow,
  StatusChip,
} from '../../../components/pro-suite/domain-agents/DomainAgentPrimitives';
import { domainArtifacts, getAgent, getArtifact, getTask, getWorkflow } from './mockDomainAgents';
import type { DomainMessage } from './types';

const artifactMarkdown = `# Monthly Business Review

## Summary
Delivery margin compressed while revenue quality stayed stable. The pressure is not demand; it is the cost of delivery and senior team load.

## Margin movement
Subcontractor mix rose across the period and pulled contribution down. The work is still strategically useful, but the pricing architecture is not absorbing delivery complexity.

## Recommendations
- Review pricing architecture before the next sprint lock.
- Separate senior strategy time from execution QA.
- Promote this artifact once the founder accepts the review gate.`;

export const DomainAgentWorkspace: React.FC = () => {
  const { taskId } = useParams();
  const task = getTask(taskId);
  const agent = getAgent(task.agentId);
  const workflow = getWorkflow(task.workflowId);
  const artifact = getArtifact(task.artifactId) ?? domainArtifacts[0];
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState<DomainMessage[]>(task.messages);
  const [resources, setResources] = useState(task.resources);
  const [promoted, setPromoted] = useState(Boolean(artifact?.promoted));

  const canReviewArtifact = task.status === 'review' || task.status === 'done';
  const statusText = task.status === 'blocked' ? 'Blocked - waiting on you' : `${task.status[0].toUpperCase()}${task.status.slice(1)}`;

  const previewMarkdown = useMemo(() => {
    if (!canReviewArtifact) {
      return `# ${workflow.defaultTaskTitle}

The artifact preview will render here as the workflow produces markdown.

## Current state
${task.status === 'blocked' ? 'Waiting on founder resource input before analysis can continue.' : 'The agent is checking context and assembling the working read.'}`;
    }

    return artifactMarkdown;
  }, [artifact.id, canReviewArtifact, task.status, workflow.defaultTaskTitle]);

  const submitReply = () => {
    const value = reply.trim();
    if (!value) return;
    setMessages((current) => [
      ...current,
      {
        id: `founder-${Date.now()}`,
        role: 'founder',
        content: value,
      },
    ]);
    setReply('');
  };

  const attachResource = () => {
    setResources((current) => [...current, `Founder upload ${current.length + 1}.csv`]);
    setMessages((current) => [
      ...current,
      {
        id: `resource-${Date.now()}`,
        role: 'founder',
        content: 'Attached the missing resource for this run.',
      },
      {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: 'Received. In the live build this would move Blocked back into Running once the required resource is satisfied.',
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/pro/intelligence/domain-agents/agents/${agent.id}`} className="aos-btn aos-btn--outline aos-btn--sm">
            <ArrowLeft className="h-4 w-4" />
            {agent.shortName} Agent
          </Link>
          <StatusChip status={task.status} waitingOn={task.waitingOn} />
        </div>
        <Link to="/pro/intelligence/domain-agents/tasks" className="aos-btn aos-btn--ghost aos-btn--sm">
          View Kanban
        </Link>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft-1)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <AgentMark agent={agent} />
            <div>
              <div className="text-sm font-semibold text-[var(--fg-1)]">{task.title}</div>
              <div className="aos-mono text-xs text-[var(--fg-3)]">
                {workflow.name} / {task.runLabel} / {task.period ?? 'Current run'} / {statusText}
              </div>
            </div>
          </div>
          <div className="text-xs text-[var(--fg-3)]">
            Resources: <span className="aos-mono text-[var(--fg-1)]">{resources.length} attached</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-h-[620px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
          <div className="border-b border-[var(--aos-mist)] px-5 py-4">
            <SectionEyebrow>Task-bound workspace</SectionEyebrow>
            <p className="text-sm leading-relaxed text-[var(--fg-3)]">
              The agent narrates the plan, checks OS Engine first, asks for missing resources, and stays bound to this workflow run.
            </p>
          </div>

          <div className="flex min-h-[430px] flex-col gap-5 px-5 py-5">
            {messages.map((message) => {
              const isFounder = message.role === 'founder';
              return (
                <div key={message.id} className={`flex ${isFounder ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[86%] gap-3 ${isFounder ? 'flex-row-reverse' : ''}`}>
                    {!isFounder && <AgentMark agent={agent} size="sm" />}
                    <div
                      className={`rounded-[var(--radius-sm)] px-4 py-3 text-sm leading-relaxed ${
                        isFounder
                          ? 'bg-[var(--aos-slate-blue)] text-[var(--fg-on-dark)]'
                          : 'border border-[var(--aos-mist)] bg-[var(--bg-canvas)] text-[var(--fg-1)]'
                      }`}
                    >
                      {message.content}
                      {message.uploadPrompt && (
                        <button
                          onClick={attachResource}
                          className="mt-3 flex w-full items-center gap-2 rounded-[var(--radius-xs)] border border-dashed border-[var(--aos-steel-blue)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs font-medium text-[var(--aos-slate-blue)] transition-colors hover:border-[var(--aos-brass)]"
                        >
                          <Paperclip className="h-4 w-4" />
                          {message.uploadPrompt}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="mt-auto rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-4">
              <SectionEyebrow>Progress</SectionEyebrow>
              <div className="space-y-3">
                {task.progress.map((step) => (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 ${
                        step.state === 'done'
                          ? 'border-[var(--aos-brass)] bg-[var(--aos-brass)]'
                          : step.state === 'current'
                            ? 'border-[var(--aos-brass)] bg-[var(--bg-surface)]'
                            : 'border-[var(--aos-steel-blue)] bg-transparent'
                      }`}
                    />
                    <span className={step.state === 'pending' ? 'text-[var(--fg-3)]' : 'text-[var(--fg-1)]'}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] px-5 py-4">
            <div className="flex items-end gap-2 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] px-3 py-2 focus-within:border-[var(--aos-brass)]">
              <button className="rounded-md p-2 text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]" onClick={attachResource} title="Attach resource">
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Reply, ask about this artifact, or attach a needed resource..."
                rows={1}
                className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-2 text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:outline-none"
              />
              <button className="rounded-md bg-[var(--aos-brass)] p-2 text-[var(--fg-on-dark)] disabled:opacity-40" onClick={submitReply} disabled={!reply.trim()} title="Send reply">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--fg-4)]">
              Scoped to this task. Open-ended strategy belongs in Virtual CSO.
            </p>
          </div>
        </div>

        <aside className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-1)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--aos-mist)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--fg-1)]">Artifact preview</div>
              <div className="aos-mono text-xs text-[var(--fg-3)]">markdown to HTML render</div>
            </div>
            <span className="aos-chip aos-chip--brass">Right rail</span>
          </div>

          {/* Open decision: fixed right rail for now; structure can become a collapsible drawer later. */}
          <div className="max-h-[520px] overflow-y-auto p-5">
            <div className="os-reader-markdown">
              <ReactMarkdown>{previewMarkdown}</ReactMarkdown>
            </div>
          </div>

          <div className="space-y-3 border-t border-[var(--aos-mist)] p-4">
            {canReviewArtifact ? (
              <>
                <button className="aos-btn aos-btn--primary w-full">
                  <Check className="h-4 w-4" />
                  Accept review
                </button>
                <button className="aos-btn aos-btn--outline w-full">
                  <Download className="h-4 w-4" />
                  Download artifact
                </button>
                <button
                  className="aos-btn aos-btn--brass w-full"
                  onClick={() => setPromoted(true)}
                  disabled={promoted}
                >
                  {promoted ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {promoted ? 'Added to Second Brain' : 'Add to Second Brain'}
                </button>
              </>
            ) : (
              <p className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-3 text-sm leading-relaxed text-[var(--fg-3)]">
                Download and Second Brain promotion unlock when the task reaches Review.
              </p>
            )}
            <Link
              to="/settings/ai-usage"
              className="block text-center text-xs font-medium text-[var(--aos-slate-blue)] hover:text-[var(--aos-obsidian)]"
            >
              View AI usage in Settings
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
};
