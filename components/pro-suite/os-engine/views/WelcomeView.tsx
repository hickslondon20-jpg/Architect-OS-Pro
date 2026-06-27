import React, { useState } from 'react';
import { Sparkles, Upload } from 'lucide-react';
import { Button, Checkbox } from '../../../ui';
import { IMPORT_SOURCES } from '../../../../lib/osEngineApi';

export const WelcomeView: React.FC<{
  onboarded: boolean;
  onBuild: (selectedSources: string[]) => Promise<void>;
  onGoToUploads: () => Promise<void>;
}> = ({ onboarded, onBuild, onGoToUploads }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(IMPORT_SOURCES.map((s) => [s.id, true])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const selectedSources = Object.entries(checked)
    .filter(([, selected]) => selected)
    .map(([id]) => id);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="mb-2 flex items-center gap-2 text-[var(--aos-brass)]">
        <Sparkles size={18} />
        <span className="aos-eyebrow text-[var(--aos-brass)]">First-run setup</span>
      </div>
      <h1 className="aos-h1 mb-2">Build your knowledge base</h1>
      <p className="mb-8 text-[var(--fg-2)]">
        Your OS Engine learns from what the platform already knows about your agency. Choose what to pull
        into the initial build - everything is selected by default. You can always add more later.
      </p>

      {onboarded && (
        <p className="mb-4 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-3 text-sm text-[var(--fg-2)]">
          Your knowledge base has been initialized. You can still revisit setup or upload your own files.
        </p>
      )}

      <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)]">
        {IMPORT_SOURCES.map((source, i) => (
          <label
            key={source.id}
            htmlFor={`import-${source.id}`}
            className={`flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-canvas)] ${
              i !== IMPORT_SOURCES.length - 1 ? 'border-b border-[var(--aos-mist)]' : ''
            }`}
          >
            <Checkbox
              id={`import-${source.id}`}
              checked={!!checked[source.id]}
              onChange={() => toggle(source.id)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-[var(--fg-1)]">{source.label}</div>
              <div className="text-xs text-[var(--fg-3)]">{source.description}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={selectedSources.length === 0 || busy}
          onClick={() => run(() => onBuild(selectedSources), 'Could not save setup.')}
        >
          <Sparkles size={16} className="mr-2" />
          {busy ? 'Saving...' : 'Build my knowledge base'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(onGoToUploads, 'Could not skip setup.')}
        >
          <Upload size={16} className="mr-2" />
          Skip - upload my own
        </Button>
        <span className="text-xs text-[var(--fg-3)]">
          {selectedSources.length} of {IMPORT_SOURCES.length} sources selected
        </span>
      </div>

      <p className="mt-6 text-xs text-[var(--fg-4)]">
        This saves your setup and scaffolds the five core pages. Populated synthesis comes online in WS4.
      </p>
      {message && <p className="mt-3 text-xs text-[var(--aos-risk)]">{message}</p>}
    </div>
  );
};
