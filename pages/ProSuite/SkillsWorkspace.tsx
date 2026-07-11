import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Download, FileArchive, Library, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui';
import {
  createSkill,
  deleteSkill,
  exportSkillZip,
  importSkillZip,
  loadSkills,
  requestGuidedSkillDraft,
  type SkillPack,
  type SkillPayload,
} from '../../lib/skillsApi';

const emptyForm: SkillPayload = {
  name: '',
  description: '',
  domain: '',
  skill_kind: '',
  trigger_tags: [],
  required_platform_context: [],
  body: '',
};

const toList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const fromList = (value: string[]) => value.join(', ');

export const SkillsWorkspace: React.FC = () => {
  const [skills, setSkills] = useState<SkillPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<SkillPayload>(emptyForm);
  const [tags, setTags] = useState('');
  const [contexts, setContexts] = useState('');
  const [saving, setSaving] = useState(false);
  const [guidedInput, setGuidedInput] = useState('');
  const [guidedMessages, setGuidedMessages] = useState<Array<{ role: 'founder' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Describe the repeatable method you want this skill to capture. I will turn it into a reviewable SKILL.md draft before anything is saved.',
    },
  ]);
  const [guidedDraft, setGuidedDraft] = useState<Partial<SkillPayload>>({});
  const [guidedBusy, setGuidedBusy] = useState(false);

  const globalSkills = useMemo(() => skills.filter((skill) => skill.scope === 'global'), [skills]);
  const ownSkills = useMemo(() => skills.filter((skill) => skill.scope !== 'global'), [skills]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setSkills(await loadSkills());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load skills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submitManual = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createSkill({
        ...form,
        trigger_tags: toList(tags),
        required_platform_context: toList(contexts),
      });
      setForm(emptyForm);
      setTags('');
      setContexts('');
      setNotice('Skill created. It is now available to Virtual CSO routing.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create skill.');
    } finally {
      setSaving(false);
    }
  };

  const submitGuidedTurn = async () => {
    const content = guidedInput.trim();
    if (!content) return;
    const messages = [...guidedMessages, { role: 'founder' as const, content }];
    setGuidedInput('');
    setGuidedMessages(messages);
    setGuidedBusy(true);
    setError(null);
    try {
      const draft = await requestGuidedSkillDraft(messages, guidedDraft);
      setGuidedDraft(draft);
      setGuidedMessages([...messages, { role: 'assistant', content: draft.assistant_message }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue guided creation.');
    } finally {
      setGuidedBusy(false);
    }
  };

  const saveGuidedDraft = async () => {
    if (!guidedDraft.name || !guidedDraft.description || !guidedDraft.body) {
      setError('The guided draft needs a name, description, and SKILL.md body before saving.');
      return;
    }
    setGuidedBusy(true);
    setError(null);
    try {
      await createSkill({
        name: guidedDraft.name,
        description: guidedDraft.description,
        domain: guidedDraft.domain ?? '',
        skill_kind: guidedDraft.skill_kind ?? '',
        trigger_tags: guidedDraft.trigger_tags ?? [],
        required_platform_context: guidedDraft.required_platform_context ?? [],
        body: guidedDraft.body,
      });
      setGuidedDraft({});
      setGuidedMessages([
        {
          role: 'assistant',
          content: 'Saved. Start another guided skill whenever you are ready.',
        },
      ]);
      setNotice('Guided skill created. It is now available to Virtual CSO routing.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save guided skill.');
    } finally {
      setGuidedBusy(false);
    }
  };

  const importZip = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      await importSkillZip(file);
      setNotice('Skill imported from ZIP.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import skill.');
    }
  };

  const removeSkill = async (skill: SkillPack) => {
    setError(null);
    try {
      await deleteSkill(skill.id);
      setNotice('Skill deleted.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete skill.');
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="aos-eyebrow mb-2 text-[var(--aos-brass)]">Intelligence Hub</div>
          <h1 className="aos-h1">Skills & Plugins</h1>
          <p className="aos-body mt-3 max-w-3xl text-[var(--fg-2)]">
            Build repeatable Virtual CSO capabilities, import open SKILL.md packs, and browse the skills available in your workspace.
          </p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--fg-2)]"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {(error || notice) && (
        <div
          className="rounded-[var(--radius-xs)] border px-4 py-3 text-sm"
          style={{
            background: error ? 'var(--aos-risk-tint)' : 'var(--aos-success-tint)',
            borderColor: error ? 'var(--aos-risk)' : 'var(--aos-success)',
            color: 'var(--fg-1)',
          }}
        >
          {error || notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="p-6 xl:col-span-7" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)' }}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="aos-eyebrow mb-1">Library</div>
              <h2 className="aos-h3">Available skills</h2>
            </div>
            <Library className="h-5 w-5 text-[var(--aos-brass)]" />
          </div>
          {loading ? (
            <p className="text-sm text-[var(--fg-3)]">Loading skills...</p>
          ) : (
            <div className="space-y-5">
              <SkillSection title="Platform skills" skills={globalSkills} onExport={exportSkillZip} />
              <SkillSection title="Your skills" skills={ownSkills} onExport={exportSkillZip} onDelete={removeSkill} />
            </div>
          )}
        </Card>

        <div className="space-y-5 xl:col-span-5">
          <Card className="p-6" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)' }}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="aos-eyebrow mb-1">Manual Creator</div>
                <h2 className="aos-h3">Create a skill</h2>
              </div>
              <Plus className="h-5 w-5 text-[var(--aos-brass)]" />
            </div>
            <div className="space-y-3">
              <TextInput label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
              <TextInput label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextInput label="Domain" value={form.domain ?? ''} onChange={(domain) => setForm({ ...form, domain })} />
                <TextInput label="Kind" value={form.skill_kind ?? ''} onChange={(skill_kind) => setForm({ ...form, skill_kind })} />
              </div>
              <TextInput label="Trigger tags" value={tags} onChange={setTags} placeholder="pricing, margin, review" />
              <TextInput label="Context keys" value={contexts} onChange={setContexts} placeholder="financial_context, current_quarter_sprint" />
              <label className="block">
                <span className="aos-eyebrow mb-1 block">SKILL.md Body</span>
                <textarea
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  rows={7}
                  className="w-full rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--fg-1)] focus:outline-none"
                />
              </label>
              <button
                onClick={submitManual}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--aos-brass)] px-4 py-2 text-sm font-medium text-[var(--fg-on-dark)] disabled:opacity-60"
              >
                <Plus size={15} />
                {saving ? 'Creating...' : 'Create skill'}
              </button>
            </div>
          </Card>

          <Card className="p-6" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)' }}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="aos-eyebrow mb-1">AI-Guided Creator</div>
                <h2 className="aos-h3">Draft with guidance</h2>
              </div>
              <Sparkles className="h-5 w-5 text-[var(--aos-brass)]" />
            </div>
            <div className="mb-3 max-h-52 space-y-2 overflow-y-auto rounded-[var(--radius-xs)] bg-[var(--bg-canvas)] p-3">
              {guidedMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className="rounded-[var(--radius-xs)] px-3 py-2 text-sm"
                  style={{
                    background: message.role === 'assistant' ? 'var(--bg-surface)' : 'var(--aos-brass-tint)',
                    color: 'var(--fg-1)',
                    border: 'var(--border-hairline)',
                  }}
                >
                  {message.content}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={guidedInput}
                onChange={(event) => setGuidedInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitGuidedTurn();
                }}
                className="min-w-0 flex-1 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--fg-1)] focus:outline-none"
              />
              <button
                onClick={submitGuidedTurn}
                disabled={guidedBusy}
                className="rounded-md bg-[var(--aos-brass)] px-3 text-sm font-medium text-[var(--fg-on-dark)] disabled:opacity-60"
              >
                <Bot size={15} />
              </button>
            </div>
            {guidedDraft.name && (
              <div className="mt-4 rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-3">
                <div className="text-sm font-medium text-[var(--fg-1)]">{guidedDraft.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--fg-3)]">{guidedDraft.description}</p>
                <button
                  onClick={saveGuidedDraft}
                  disabled={guidedBusy}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--aos-brass)] px-3 py-2 text-sm font-medium text-[var(--fg-on-dark)] disabled:opacity-60"
                >
                  Confirm and create
                </button>
              </div>
            )}
          </Card>

          <Card className="p-6" style={{ background: 'var(--bg-surface)', border: 'var(--border-hairline)' }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="aos-eyebrow mb-1">Import</div>
                <h2 className="aos-h3">SKILL.md ZIP</h2>
              </div>
              <FileArchive className="h-5 w-5 text-[var(--aos-brass)]" />
            </div>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.currentTarget.value = '';
                importZip(file);
              }}
              className="block w-full text-sm text-[var(--fg-2)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--aos-brass)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--fg-on-dark)]"
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className="aos-eyebrow mb-1 block">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--fg-1)] placeholder:text-[var(--fg-4)] focus:outline-none"
    />
  </label>
);

const SkillSection: React.FC<{
  title: string;
  skills: SkillPack[];
  onExport: (skill: SkillPack) => void;
  onDelete?: (skill: SkillPack) => void;
}> = ({ title, skills, onExport, onDelete }) => (
  <section>
    <div className="aos-eyebrow mb-2">{title}</div>
    <div className="space-y-2">
      {skills.length === 0 ? (
        <p className="rounded-[var(--radius-xs)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--fg-3)]">No skills yet.</p>
      ) : (
        skills.map((skill) => (
          <div
            key={skill.id}
            className="rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-canvas)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--fg-1)]">{skill.name}</h3>
                  <span className="rounded bg-[var(--aos-brass-tint)] px-2 py-0.5 text-xs text-[var(--aos-brass)]">@{skill.slug}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--fg-2)]">{skill.description}</p>
                <p className="mt-2 text-xs text-[var(--fg-3)]">
                  {[skill.domain, skill.skill_kind, fromList(skill.trigger_tags ?? [])].filter(Boolean).join(' · ') || 'No metadata tags'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => onExport(skill)}
                  className="rounded-md p-2 text-[var(--fg-3)] hover:bg-[var(--bg-surface)] hover:text-[var(--aos-brass)]"
                  title="Export SKILL.md ZIP"
                >
                  <Download size={15} />
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(skill)}
                    className="rounded-md p-2 text-[var(--fg-3)] hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
                    title="Delete skill"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </section>
);
