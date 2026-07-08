import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

export interface ReaderProps {
  open: boolean;
  title?: string;
  /** Small metadata line(s) rendered under the title (e.g. last updated, sources). */
  meta?: React.ReactNode;
  /** Markdown body. Rendered to HTML. */
  content?: string;
  /** Structured body for non-markdown reader surfaces such as resolved citations. */
  body?: React.ReactNode;
  /** Optional footer region (e.g. the Notes & corrections composer). */
  footer?: React.ReactNode;
  onClose: () => void;
}

/**
 * Shared collapsible right-hand reader.
 * Collapsed/hidden by default — renders nothing when `open` is false.
 * Reused by the OS Engine workspace and the Virtual CSO workspace.
 */
export const Reader: React.FC<ReaderProps> = ({ open, title, meta, content, body, footer, onClose }) => {
  if (!open) return null;

  return (
    <aside
      className="flex w-full max-w-[480px] flex-shrink-0 flex-col border-l border-[var(--aos-mist)] bg-[var(--bg-surface)]"
      aria-label="Reader"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--aos-mist)] px-6 py-4">
        <div className="min-w-0">
          {title && <h3 className="aos-h3 truncate">{title}</h3>}
          {meta && <div className="mt-1 text-xs text-[var(--fg-3)]">{meta}</div>}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-md p-1.5 text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
          title="Close reader"
          aria-label="Close reader"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {body ? (
          body
        ) : content ? (
          <div className="os-reader-markdown">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-3)]">Nothing to display.</p>
        )}
      </div>

      {footer && <div className="border-t border-[var(--aos-mist)] px-6 py-4">{footer}</div>}
    </aside>
  );
};
