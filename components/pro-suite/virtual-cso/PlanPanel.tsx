import React, { useState } from 'react';
import { Check, Circle, ListChecks, Plus, Save, X } from 'lucide-react';
import type { AgentTodo } from '../../../lib/virtualCsoApi';

const nextTodo = (content = ''): AgentTodo => ({
  id: `local-${Date.now()}`,
  threadId: '',
  content,
  status: 'pending',
  position: 0,
});

export const PlanPanel: React.FC<{
  open: boolean;
  todos: AgentTodo[];
  saving?: boolean;
  onSave: (todos: AgentTodo[]) => void;
}> = ({ open, todos, saving = false, onSave }) => {
  const [draft, setDraft] = useState<AgentTodo[]>(todos);

  React.useEffect(() => setDraft(todos), [todos]);

  if (!open) return null;

  const update = (index: number, patch: Partial<AgentTodo>) => {
    setDraft((current) => current.map((todo, i) => (i === index ? { ...todo, ...patch } : todo)));
  };

  const remove = (index: number) => {
    setDraft((current) => current.filter((_, i) => i !== index));
  };

  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-[var(--aos-mist)] bg-[var(--bg-canvas)]">
      <div className="border-b border-[var(--aos-mist)] px-4 py-3">
        <p className="aos-eyebrow flex items-center gap-1.5">
          <ListChecks size={12} /> Deep plan
        </p>
      </div>
      <div className="space-y-2 p-3">
        {draft.map((todo, index) => (
          <div key={todo.id} className="rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-2">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() =>
                  update(index, {
                    status: todo.status === 'completed' ? 'pending' : 'completed',
                  })
                }
                className="mt-1 rounded-md p-1 text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--aos-brass)]"
                title={todo.status === 'completed' ? 'Mark pending' : 'Mark complete'}
                aria-label={todo.status === 'completed' ? 'Mark pending' : 'Mark complete'}
              >
                {todo.status === 'completed' ? <Check size={14} /> : <Circle size={14} />}
              </button>
              <textarea
                value={todo.content}
                onChange={(event) => update(index, { content: event.target.value })}
                rows={2}
                className="min-h-[44px] flex-1 resize-none bg-transparent text-sm text-[var(--fg-1)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="mt-1 rounded-md p-1 text-[var(--fg-3)] hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
                title="Remove"
                aria-label="Remove todo"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setDraft((current) => [...current, nextTodo()])}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--aos-mist)] px-3 py-2 text-xs text-[var(--fg-3)] hover:border-[var(--aos-brass)] hover:text-[var(--fg-1)]"
        >
          <Plus size={14} /> Add step
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave(
              draft
                .map((todo, index) => ({ ...todo, content: todo.content.trim(), position: index }))
                .filter((todo) => todo.content),
            )
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--aos-brass)] px-3 py-2 text-xs font-medium text-[var(--fg-on-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={14} /> Save plan
        </button>
      </div>
    </aside>
  );
};
