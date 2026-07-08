import React, { useState } from 'react';
import { ArrowUp, BrainCircuit, Minimize2, Paperclip, X } from 'lucide-react';
import type { ContextRemainingSignal } from '../../../lib/virtualCsoApi';

/**
 * Chat composer: multi-line input + submit, an add-context affordance,
 * and a removable linked-folder chip representing optional retrieval scoping.
 */
export const Composer: React.FC<{
  onSubmit?: (text: string) => void;
  linkedFolder?: string | null;
  onRemoveLinkedFolder?: () => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  contextSignal?: ContextRemainingSignal | null;
  onCompact?: () => void;
  compacting?: boolean;
  onAttach?: () => void;
  deepMode?: boolean;
  onDeepModeChange?: (enabled: boolean) => void;
}> = ({
  onSubmit,
  linkedFolder,
  onRemoveLinkedFolder,
  placeholder = 'Ask your Virtual CSO...',
  value,
  onChange,
  textareaRef,
  contextSignal,
  onCompact,
  compacting = false,
  onAttach,
  deepMode = false,
  onDeepModeChange,
}) => {
  const [localText, setLocalText] = useState('');
  const text = value ?? localText;
  const setText = onChange ?? setLocalText;

  const submit = () => {
    const nextValue = text.trim();
    if (!nextValue) return;
    onSubmit?.(nextValue);
    setText('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  const showCompaction = contextSignal?.band === 'amber' || contextSignal?.band === 'red';
  const barColor =
    contextSignal?.band === 'red'
      ? 'var(--aos-risk)'
      : contextSignal?.band === 'amber'
        ? 'var(--aos-brass)'
        : 'var(--aos-teal)';

  return (
    <div className="border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] px-6 py-4">
      <div className="mx-auto max-w-3xl">
        {contextSignal && (
          <div className="mb-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-canvas)]">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${contextSignal.remainingPercent}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="aos-mono min-w-[132px] text-right text-[11px] text-[var(--fg-3)]">
              {contextSignal.remainingPercent}% context remaining
            </span>
            {showCompaction && onCompact && (
              <button
                onClick={onCompact}
                disabled={compacting}
                className="rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--aos-brass)] disabled:cursor-not-allowed disabled:opacity-40"
                title="Compact thread context"
                aria-label="Compact thread context"
              >
                <Minimize2 size={15} />
              </button>
            )}
          </div>
        )}
        {linkedFolder && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--aos-sage)] bg-[var(--aos-sage-soft)] px-2.5 py-1 text-xs text-[var(--fg-2)]">
              linked: {linkedFolder}
              <button
                onClick={onRemoveLinkedFolder}
                className="rounded-full p-0.5 text-[var(--fg-3)] transition-colors hover:text-[var(--fg-1)]"
                title="Remove linked folder"
                aria-label="Remove linked folder"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-3 py-2 focus-within:border-[var(--aos-brass)] focus-within:ring-1 focus-within:ring-[var(--aos-brass)]">
          <button
            onClick={onAttach}
            className="mb-0.5 flex-shrink-0 rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
            title="Add context / link a folder"
            aria-label="Add context"
            type="button"
          >
            <Paperclip size={16} />
          </button>
          {onDeepModeChange && (
            <button
              onClick={() => onDeepModeChange(!deepMode)}
              className={`mb-0.5 flex-shrink-0 rounded-md p-1.5 transition-colors ${
                deepMode
                  ? 'bg-[var(--aos-brass)] text-[var(--fg-on-dark)]'
                  : 'text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]'
              }`}
              title={deepMode ? 'Deep Mode on' : 'Deep Mode off'}
              aria-label={deepMode ? 'Turn Deep Mode off' : 'Turn Deep Mode on'}
              type="button"
            >
              <BrainCircuit size={16} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="mb-0.5 flex-shrink-0 rounded-md bg-[var(--aos-brass)] p-1.5 text-[var(--fg-on-dark)] transition-colors hover:bg-[var(--aos-brass-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            title="Send"
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--fg-4)]">
          The CSO reads your wiki, platform data, and the Architect OS IP. Linking a folder narrows the
          search; it still draws on everything by default.
        </p>
      </div>
    </div>
  );
};
