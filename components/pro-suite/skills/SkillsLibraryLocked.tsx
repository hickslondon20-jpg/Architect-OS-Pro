import React from 'react';
import { Archive, Library, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../../ui';

export const SkillsLibraryLocked: React.FC = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
    <div className="max-w-xl overflow-hidden rounded-[var(--radius-md)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft-2)]">
      <div className="px-9 py-10">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ backgroundColor: 'var(--bg-inverse)' }}
        >
          <Library size={26} style={{ color: 'var(--aos-brass)' }} />
        </div>

        <p className="aos-eyebrow mb-2 text-[var(--aos-brass)]">ArchitectOS Pro</p>
        <h2 className="aos-h2 mb-3">Skills & Plugins</h2>
        <p className="mb-7 text-[var(--fg-2)]">
          Reusable methods for your Virtual CSO: founder-authored skills, platform skills, and SKILL.md imports in one workspace.
        </p>

        <div className="mb-8 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">Create repeatable strategy workflows with a guided builder.</p>
          </div>
          <div className="flex items-start gap-3">
            <Archive size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">Import and export portable SKILL.md ZIP packs.</p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-[var(--aos-brass)]" />
            <p className="text-sm text-[var(--fg-2)]">Founder-created skills stay owner-scoped by default.</p>
          </div>
        </div>

        <Button variant="primary">Unlock Skills & Plugins</Button>
      </div>
    </div>
  </div>
);
