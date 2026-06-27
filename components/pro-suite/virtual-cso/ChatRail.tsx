import React, { useState } from 'react';
import { Plus, Search, Pin, Clock, Folder, Settings, MessageSquare, Trash2 } from 'lucide-react';
import { getPinnedChats, getRecentChats, type Chat, type Project } from '../../../lib/virtualCsoApi';

export const ChatRail: React.FC<{
  chats: Chat[];
  projects: Project[];
  activeChatId: string | null;
  activeProjectId: string | null;
  view: 'chat' | 'project' | 'new';
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (projectId: string) => void;
}> = ({
  chats,
  projects,
  activeChatId,
  activeProjectId,
  view,
  onNewChat,
  onSelectChat,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const pinned = getPinnedChats(chats);
  const recent = getRecentChats(chats);

  const submitProject = () => {
    const value = newProjectName.trim();
    if (!value) return;
    onCreateProject(value);
    setNewProjectName('');
  };

  const chatRow = (chat: Chat, icon: React.ElementType) => {
    const Icon = icon;
    const isActive = view === 'chat' && activeChatId === chat.id;
    return (
      <button
        key={chat.id}
        onClick={() => onSelectChat(chat.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
          isActive
            ? 'border-l-[3px] border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] pl-[7px] font-medium text-[var(--fg-1)]'
            : 'text-[var(--fg-2)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]'
        }`}
      >
        <Icon
          size={14}
          className={`flex-shrink-0 ${isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`}
        />
        <span className="truncate">{chat.title}</span>
      </button>
    );
  };

  return (
    <nav
      className="flex w-[210px] flex-shrink-0 flex-col border-r border-[var(--aos-mist)] bg-[var(--bg-canvas)]"
      aria-label="Virtual CSO conversations"
    >
      <div className="px-3 pb-2 pt-3">
        <p className="aos-eyebrow px-1 pb-2">Virtual CSO</p>
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--aos-brass)] px-3 py-2 text-sm font-medium text-[var(--fg-on-dark)] transition-colors hover:bg-[var(--aos-brass-soft)]"
        >
          <Plus size={15} />
          New chat
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2.5 py-1.5">
          <Search size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
          <input
            placeholder="Search"
            className="w-full bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="mb-4">
          <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
            <Pin size={11} /> Pinned
          </p>
          <div className="space-y-0.5">
            {pinned.length === 0 ? (
              <p className="px-1 text-xs text-[var(--fg-4)]">No pinned chats.</p>
            ) : (
              pinned.map((c) => chatRow(c, Pin))
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
            <Clock size={11} /> Recent
          </p>
          <div className="space-y-0.5">
            {recent.length === 0 ? (
              <p className="px-1 text-xs text-[var(--fg-4)]">No conversations yet.</p>
            ) : (
              recent.map((c) => chatRow(c, MessageSquare))
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
            <Folder size={11} /> Projects
          </p>
          <div className="mb-2 flex gap-1">
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitProject();
              }}
              placeholder="New project"
              className="min-w-0 flex-1 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:outline-none"
            />
            <button
              onClick={submitProject}
              className="rounded-md bg-[var(--aos-brass)] px-2 text-xs text-[var(--fg-on-dark)]"
              title="Create project"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="space-y-0.5">
            {projects.map((p) => {
              const isActive = view === 'project' && activeProjectId === p.id;
              return (
                <div key={p.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => onSelectProject(p.id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                      isActive
                        ? 'border-l-[3px] border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] pl-[7px] font-medium text-[var(--fg-1)]'
                        : 'text-[var(--fg-2)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]'
                    }`}
                  >
                    <Folder
                      size={14}
                      className={`flex-shrink-0 ${isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`}
                    />
                    <span className="truncate">{p.name}</span>
                  </button>
                  <button
                    onClick={() => onDeleteProject(p.id)}
                    className="rounded-md p-1 text-[var(--fg-4)] opacity-0 transition-all hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)] group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--aos-mist)] p-3">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]"
          title="Settings"
        >
          <Settings size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};
