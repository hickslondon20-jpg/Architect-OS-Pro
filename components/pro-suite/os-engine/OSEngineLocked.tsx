import React from 'react';
import { Brain, Upload, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '../../ui';

/**
 * Aspirational locked state for non-Pro founders.
 * AOS-tokened — intentionally NOT the generic slate LockedFeatureState.
 * No pricing; a single upgrade prompt.
 */
export const OSEngineLocked: React.FC = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
    <div className="max-w-xl overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-2)]">
      <div className="px-9 py-10">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ backgroundColor: 'var(--bg-inverse)' }}
        >
          <Brain size={26} style={{ color: 'var(--aos-brass)' }} />
        </div>

        <p className="aos-eyebrow mb-2 text-[var(--aos-brass)]">ArchitectOS Pro</p>
        <h2 className="aos-h2 mb-3">The OS Engine</h2>
        <p className="mb-7 text-[var(--fg-2)]">
          Your agency's second brain. The OS Engine learns from your uploads, your assessments, and your
          planning work — then synthesizes everything it knows into a living wiki you can read, correct,
          and build on. It's the context layer that makes every other tool sharper over time.
        </p>

        <div className="mb-8 space-y-3">
          <div className="flex items-start gap-3">
            <Upload size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">
              Bring in your own files — financials, decks, notes — privately.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">
              Watch the platform synthesize what it knows about your agency into clear, readable pages.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">
              A knowledge base that compounds — and that your Virtual CSO draws on in every conversation.
            </p>
          </div>
        </div>

        <Button variant="primary">Unlock the OS Engine</Button>
      </div>
    </div>
  </div>
);
