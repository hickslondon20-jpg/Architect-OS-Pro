import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../../lib/virtualCsoApi';
import { AgentStepsPanel } from './AgentStepsPanel';
import { ArtifactDeliveryCard } from './ArtifactDeliveryCard';

/**
 * One chat message.
 * - user: right-aligned, slate/obsidian family fill, light text.
 * - assistant: left-aligned reader text with copy affordance.
 * No edit / regenerate. No create-doc card.
 */
export const MessageBubble: React.FC<{
  message: Message;
  onOpenArtifact?: (artifactId: string) => void;
}> = ({ message, onOpenArtifact }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    navigator.clipboard?.writeText(message.content).catch(() => {});
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
      <div className="os-reader-markdown w-full text-sm">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      <button
        onClick={onCopy}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--fg-3)] opacity-0 transition-all hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] focus:opacity-100 group-hover:opacity-100"
        title="Copy message"
        aria-label="Copy message"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};
