import React from 'react';
import { Compass, MessageSquare, Layers, ShieldCheck } from 'lucide-react';
import { Button } from '../../ui';

/**
 * Aspirational locked state for non-Pro founders.
 * AOS-tokened — intentionally NOT the generic slate LockedFeatureState.
 * No pricing; a single upgrade prompt.
 */
export const VirtualCSOLocked: React.FC = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
    <div className="max-w-xl overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-2)]">
      <div className="px-9 py-10">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ backgroundColor: 'var(--bg-inverse)' }}
        >
          <Compass size={26} style={{ color: 'var(--aos-brass)' }} />
        </div>

        <p className="aos-eyebrow mb-2 text-[var(--aos-brass)]">ArchitectOS Pro</p>
        <h2 className="aos-h2 mb-3">Your Virtual CSO</h2>
        <p className="mb-7 text-[var(--fg-2)]">
          A strategic counterpart that already knows your agency. It reads your stage, your margin, your
          client concentration, and your current sprint — then thinks through the hard calls with you.
          Grounded in your context, not generic advice.
        </p>

        <div className="mb-8 space-y-3">
          <div className="flex items-start gap-3">
            <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">
              Pressure-test a move, a hire, or a pricing decision in plain conversation.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Layers size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">
              Draws on your OS Engine wiki, your assessments, and the Architect OS IP library.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">
              Every answer shows its sources — you can see exactly what it's reasoning from.
            </p>
          </div>
        </div>

        <Button variant="primary">Unlock the Virtual CSO</Button>
      </div>
    </div>
  </div>
);
