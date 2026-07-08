import React, { useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { CitationRef, Message } from '../../../lib/virtualCsoApi';
import { AgentStepsPanel } from './AgentStepsPanel';
import { ArtifactDeliveryCard } from './ArtifactDeliveryCard';
import { AgentTaskCard } from './AgentTaskCard';
import { citationLabel, stripCitationMarkers, useOrdinalMap } from './CitationReaderBody';

/**
 * One chat message.
 * - user: right-aligned, slate/obsidian family fill, light text.
 * - assistant: left-aligned reader text with copy affordance.
 * No edit / regenerate. No create-doc card.
 */
export const MessageBubble: React.FC<{
  message: Message;
  onOpenArtifact?: (artifactId: string) => void;
  onOpenCitation?: (citation: CitationRef) => void;
  onCheckCitations?: (messageId: string) => void;
  checkingCitations?: boolean;
}> = ({ message, onOpenArtifact, onOpenCitation, onCheckCitations, checkingCitations }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const citationsByOrdinal = useOrdinalMap(message.citations);

  const onCopy = () => {
    navigator.clipboard?.writeText(stripCitationMarkers(message.content)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-[var(--radius-sm)] rounded-tr-sm bg-[var(--aos-slate-blue)] px-4 py-3 text-sm leading-relaxed text-[var(--fg-on-dark)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full flex-col items-start">
      {message.agentSteps && message.agentSteps.length > 0 && (
        <AgentStepsPanel steps={message.agentSteps} />
      )}
      {message.artifactDeliveries?.map((artifact) => (
        <ArtifactDeliveryCard key={artifact.id} artifact={artifact} onOpenArtifact={onOpenArtifact} />
      ))}
      {message.agentTasks?.map((handle) => (
        <AgentTaskCard key={handle.task.id} handle={handle} onOpenArtifact={onOpenArtifact} />
      ))}
      <div className="os-reader-markdown w-full text-sm">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p>{renderCitationChildren(children, citationsByOrdinal, onOpenCitation)}</p>
            ),
            li: ({ children }) => (
              <li>{renderCitationChildren(children, citationsByOrdinal, onOpenCitation)}</li>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {message.citations?.some((citation) => citation.verdict) && (
        <p className="mt-1 text-xs text-[var(--fg-3)]">{citationSummary(message.citations)}</p>
      )}
      <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-all focus-within:opacity-100 group-hover:opacity-100">
        {message.citations?.some((citation) => citation.source_kind !== 'derived') && (
          <button
            onClick={() => onCheckCitations?.(message.id)}
            disabled={checkingCitations}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] disabled:cursor-not-allowed disabled:opacity-50"
            title="Check citations"
            aria-label="Check citations"
          >
            <ShieldCheck size={13} />
            {checkingCitations ? 'Checking' : hasCheckedCitations(message.citations) ? 'Checked' : 'Check citations'}
          </button>
        )}
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
          title="Copy message"
          aria-label="Copy message"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

const renderCitationChildren = (
  children: React.ReactNode,
  citationsByOrdinal: Map<number, CitationRef>,
  onOpenCitation?: (citation: CitationRef) => void,
): React.ReactNode =>
  React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    return renderCitationText(child, citationsByOrdinal, onOpenCitation);
  });

const renderCitationText = (
  text: string,
  citationsByOrdinal: Map<number, CitationRef>,
  onOpenCitation?: (citation: CitationRef) => void,
): React.ReactNode => {
  const pieces: React.ReactNode[] = [];
  const markerPattern = /\[(\d+)\]/g;
  let cursor = 0;
  for (const match of text.matchAll(markerPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push(text.slice(cursor, index));
    const ordinal = Number(match[1]);
    const citation = citationsByOrdinal.get(ordinal);
    if (citation) {
      pieces.push(
        <button
          key={`${ordinal}-${index}`}
          type="button"
          onClick={() => onOpenCitation?.(citation)}
          className={`mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 align-baseline text-[11px] ${citationVerdictClassName(citation)}`}
          title={citationLabel(citation)}
          aria-label={`Open source ${ordinal}: ${citationLabel(citation)}`}
        >
          {ordinal}
        </button>,
      );
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces.length > 0 ? pieces : text;
};

const hasCheckedCitations = (citations: CitationRef[] = []): boolean =>
  citations.some((citation) => Boolean(citation.verdict));

const citationSummary = (citations: CitationRef[] = []): string => {
  const checked = citations.filter((citation) => citation.verdict);
  const counts = checked.reduce<Record<string, number>>((acc, citation) => {
    const verdict = citation.verdict?.verdict ?? 'unresolvable';
    acc[verdict] = (acc[verdict] ?? 0) + 1;
    return acc;
  }, {});
  return `Checked: ${counts.supported ?? 0} supported, ${counts.partial ?? 0} partial, ${counts.unsupported ?? 0} unsupported, ${counts.unresolvable ?? 0} unresolvable.`;
};

const citationVerdictClassName = (citation: CitationRef): string => {
  const verdict = citation.verdict?.verdict;
  if (verdict === 'supported') return 'border-[var(--aos-success)] text-[var(--aos-success)] bg-[var(--aos-success-tint)]';
  if (verdict === 'partial') return 'border-[var(--aos-brass)] text-[var(--aos-brass)] bg-[var(--aos-brass-tint)]';
  if (verdict === 'unsupported') return 'border-[var(--aos-risk)] text-[var(--aos-risk)] bg-[var(--aos-risk-tint)]';
  if (verdict === 'unresolvable') return 'border-[var(--fg-4)] text-[var(--fg-3)] bg-[var(--bg-canvas)]';
  return 'border-[var(--aos-brass)] text-[var(--aos-brass)]';
};
